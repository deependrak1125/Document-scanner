import * as Network from "expo-network";
import * as FS from "expo-file-system/legacy";
import type { CloudDocument, LocalDocument } from "@folio/shared-types";
import { ApiError } from "@folio/api-client";
import { api, authorized, useAuth } from "../auth";
import {
  db,
  markSync,
  getDocument,
  persist,
  root,
  setting,
  setSetting,
} from "../../database";
import { useSettings } from "../../store";
let running = false;
export async function sync(onProgress: (message: string) => void = () => {}) {
  if (running) throw new Error("Sync is already running.");
  if (!useSettings.getState().backup)
    throw new Error("Enable cloud backup first.");
  running = true;
  try {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected)
      throw new Error("You are offline. Your documents remain on this device.");
    await authorized(() => api.request("/auth/me"));
    const userId = useAuth.getState().user!.id;
    const withAccount = <T>(operation: () => Promise<T>) =>
      authorized(() => {
        if (
          useAuth.getState().user?.id !== userId ||
          !useSettings.getState().backup
        )
          throw new Error(
            "Sync stopped because account or backup settings changed.",
          );
        return operation();
      });
    const d = await db();
    const queue = await d.getAllAsync<{ documentId: string; revision: number }>(
      "SELECT documentId,revision FROM outbox",
    );
    for (const [index, entry] of queue.entries()) {
      const local = await getDocument(entry.documentId);
      if (!local || local.sensitive) continue;
      const owner = await setting<string | null>(`owner:${local.id}`, null);
      if (owner && owner !== userId) continue;
      onProgress(`Backing up ${index + 1} of ${queue.length}`);
      try {
        let remote: CloudDocument;
        if (!local.remoteRevision) {
          remote = await withAccount(() =>
            api.post<CloudDocument>("/documents", {
              id: local.id,
              title: local.title,
              pageCount: local.pageCount,
              favorite: local.favorite,
              folderId: null,
            }),
          );
          await setSetting(`owner:${local.id}`, userId);
        } else {
          remote = await withAccount(() =>
            api.request<CloudDocument>(`/documents/${local.id}`),
          );
          if (remote.revision !== local.remoteRevision)
            throw new ApiError(409, "This document changed on another device.");
        }
        if (local.deletedAt) {
          remote = await withAccount(() =>
            api.request<CloudDocument>(`/documents/${local.id}`, {
              method: "DELETE",
              body: JSON.stringify({ revision: remote.revision }),
            }),
          );
        } else {
          if (remote.deletedAt)
            remote = await withAccount(() =>
              api.post<CloudDocument>(`/documents/${local.id}/restore`, {
                revision: remote.revision,
              }),
            );
          remote = await withAccount(() =>
            api.patch<CloudDocument>(`/documents/${local.id}`, {
              revision: remote.revision,
              title: local.title,
              pageCount: local.pageCount,
              favorite: local.favorite,
            }),
          );
          await markSync(local.id, remote.revision, "pending");
          const upload = await withAccount(() =>
            api.post<{
              uploadId: string;
              url: string;
              headers: Record<string, string>;
            }>("/uploads/initiate", {
              documentId: local.id,
              fileSize: local.fileSize,
              mimeType: "application/pdf",
              revision: remote.revision,
            }),
          );
          try {
            const response = await FS.uploadAsync(upload.url, local.uri, {
              httpMethod: "PUT",
              uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
              headers: upload.headers,
            });
            if (response.status < 200 || response.status >= 300)
              throw new Error("File upload failed.");
            remote = await withAccount(() =>
              api.post<CloudDocument>("/uploads/complete", {
                uploadId: upload.uploadId,
              }),
            );
          } catch (error) {
            await withAccount(() =>
              api.post("/uploads/abort", { uploadId: upload.uploadId }),
            ).catch(() => {});
            throw error;
          }
        }
        await markSync(local.id, remote.revision, "synced", local.revision);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409)
          await markSync(
            local.id,
            (await getDocument(local.id))?.remoteRevision ??
              local.remoteRevision,
            "conflict",
          );
        await d.runAsync(
          "UPDATE outbox SET attempts=attempts+1,error=? WHERE documentId=?",
          error instanceof Error ? error.message : "Sync failed",
          local.id,
        );
        throw error;
      }
    }
    let cursor = await setting<string | null>(`cursor:${userId}`, null),
      more = true;
    while (more) {
      const batch = await withAccount(() =>
        api.request<{
          items: CloudDocument[];
          cursor: string | null;
          hasMore: boolean;
        }>(
          `/sync/changes?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        ),
      );
      for (const remote of batch.items) {
        const local = await getDocument(remote.id);
        if (local?.remoteRevision === remote.revision) continue;
        if (local && local.syncState !== "synced") {
          await markSync(
            local.id,
            (await getDocument(local.id))?.remoteRevision ??
              local.remoteRevision,
            "conflict",
          );
          continue;
        }
        if (remote.deletedAt) {
          if (local)
            await persist(
              {
                ...local,
                deletedAt: remote.deletedAt,
                remoteRevision: remote.revision,
                syncState: "synced",
              },
              false,
            );
          continue;
        }
        if (!remote.fileSize) continue;
        onProgress("Restoring cloud documents");
        const { url } = await withAccount(() =>
          api.request<{ url: string }>(`/documents/${remote.id}/download`),
        );
        const dir = `${root}${remote.id}/`;
        await FS.makeDirectoryAsync(dir, { intermediates: true });
        const temp = `${dir}restore.tmp`;
        const result = await FS.downloadAsync(url, temp);
        if (result.status !== 200) throw new Error("Cloud restore failed.");
        const info = await FS.getInfoAsync(temp);
        if (!info.exists || info.size !== remote.fileSize)
          throw new Error("Downloaded file is incomplete.");
        const uri = `${dir}cloud-${remote.revision}.pdf`;
        await FS.moveAsync({ from: temp, to: uri });
        const now = new Date().toISOString();
        const doc: LocalDocument = {
          ...remote,
          uri,
          pages: [],
          revision: local?.revision ?? 1,
          remoteRevision: remote.revision,
          syncState: "synced",
          text: local?.text ?? "",
          sensitive: false,
          createdAt: local?.createdAt ?? now,
        };
        const latest = await getDocument(remote.id);
        if (latest && latest.revision !== local?.revision) {
          await markSync(latest.id, latest.remoteRevision, "conflict");
          continue;
        }
        await persist(doc, false);
        await setSetting(`owner:${doc.id}`, userId);
      }
      cursor = batch.cursor;
      more = batch.hasMore;
      await setSetting(`cursor:${userId}`, cursor);
    }
    onProgress("Backup is up to date");
  } finally {
    running = false;
  }
}
export async function keepLocalConflict(doc: LocalDocument) {
  const remote = await authorized(() =>
    api.request<CloudDocument>(`/documents/${doc.id}`),
  );
  await persist({
    ...doc,
    remoteRevision: remote.revision,
    syncState: "pending",
  });
}
