import { Platform } from "react-native";
import { fetch } from "expo/fetch";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { create } from "zustand";
import {
  listDocuments,
  readBytes,
  savePdf,
  setting,
  setSetting,
} from "../../database";
import { isExpoGoRuntime } from "../../native/runtime";

const appDataScope = "https://www.googleapis.com/auth/drive.appdata";
const fileScope = "https://www.googleapis.com/auth/drive.file";
const scopes = [fileScope, appDataScope];
const folderMime = "application/vnd.google-apps.folder";
const connectionKey = "driveBackupAccount";
const maxBytes = 30 * 1024 * 1024;
const api = "https://www.googleapis.com/drive/v3";
type Account = { id: string; email: string };
type Backup = {
  id: string;
  name: string;
  size: string;
  modifiedTime?: string;
  parents?: string[];
  appProperties?: { sha256?: string };
};
export const useDriveBackup = create<{
  account: Account | null;
  busy: boolean;
  status: string;
  folderId: string | null;
  files: {
    id: string;
    name: string;
    hidden: boolean;
    size: number;
    modifiedTime?: string;
  }[];
  automatic: boolean;
  lastBackup: string | null;
  libraryRevision: number;
}>(() => ({
  account: null,
  busy: false,
  status: "",
  folderId: null,
  files: [],
  automatic: true,
  lastBackup: null,
  libraryRevision: 0,
}));

let configured = false;
async function google() {
  if (Platform.OS !== "android" || isExpoGoRuntime())
    throw new Error(
      "Google Drive backup requires the native Folio Android app.",
    );
  if (!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)
    throw new Error("Google Drive backup is not configured in this build.");
  const { GoogleSignin } =
    await import("@react-native-google-signin/google-signin");
  if (!configured) {
    GoogleSignin.configure({
      scopes,
    });
    configured = true;
  }
  return GoogleSignin;
}

export async function loadDriveConnection() {
  const [account, automatic] = await Promise.all([
    setting<Account | null>(connectionKey, null),
    setting("driveAutomaticBackup", true),
  ]);
  const lastBackup = account
    ? await setting<string | null>(`driveLastBackup:${account.id}`, null)
    : null;
  useDriveBackup.setState({ account, automatic, lastBackup });
}

export async function setAutomaticDriveBackup(automatic: boolean) {
  await setSetting("driveAutomaticBackup", automatic);
  useDriveBackup.setState({ automatic });
}

export async function connectDrive() {
  if (useDriveBackup.getState().busy) return;
  useDriveBackup.setState({ busy: true });
  try {
    const sdk = await google();
    await sdk.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await sdk.signIn();
    if (response.type !== "success") return;
    if (!scopes.every((scope) => response.data.scopes.includes(scope)))
      throw new Error("Allow Folio to access the files it creates in Drive.");
    const { id, email } = response.data.user;
    const account = { id, email };
    await setSetting(connectionKey, account);
    useDriveBackup.setState({
      account,
      lastBackup: await setting<string | null>(
        `driveLastBackup:${account.id}`,
        null,
      ),
      folderId: null,
      files: [],
      status: "Drive connected. Checking backup…",
    });
  } finally {
    useDriveBackup.setState({ busy: false });
  }
}

export async function disconnectDrive() {
  if (useDriveBackup.getState().busy)
    throw new Error("Wait for the current Drive transfer to finish.");
  const sdk = await google();
  await sdk.signOut();
  await setSetting(connectionKey, null);
  useDriveBackup.setState({
    account: null,
    lastBackup: null,
    status: "",
    folderId: null,
    files: [],
  });
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function syncDrive(listOnly = false) {
  const { account, busy } = useDriveBackup.getState();
  if (!account || busy) return;
  useDriveBackup.setState({ busy: true, status: "Checking Google Drive…" });
  try {
    const sdk = await google();
    const session = await sdk.signInSilently();
    if (
      session.type !== "success" ||
      session.data.user.id !== account.id ||
      !scopes.every((scope) => session.data.scopes.includes(scope))
    )
      throw new Error(
        "Reconnect the same Google account to continue Drive backup.",
      );
    let { accessToken } = await sdk.getTokens();
    async function request<T>(
      url: string,
      init: RequestInit,
      consume: (response: Response) => Promise<T>,
    ): Promise<T> {
      if (
        useDriveBackup.getState().account?.id !== account!.id ||
        sdk.getCurrentUser()?.user.id !== account!.id
      )
        throw new Error(
          "Drive backup stopped because the Google account changed.",
        );
      // Attach credentials only to Google API endpoints, including resumable upload URLs.
      if (!url.startsWith("https://www.googleapis.com/"))
        throw new Error("Invalid Drive endpoint.");
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            redirect: "error",
            headers: {
              ...init.headers,
              Authorization: `Bearer ${accessToken}`,
            },
          });
          if (response.status === 401 && attempt === 0) {
            await sdk.clearCachedAccessToken(accessToken);
            ({ accessToken } = await sdk.getTokens());
            continue;
          }
          if (!response.ok)
            throw new Error(
              `Google Drive request failed (${response.status}). Check your connection, access, or storage quota.`,
            );
          return await consume(response);
        } finally {
          clearTimeout(timer);
        }
      }
      throw new Error("Reconnect Google Drive to continue.");
    }

    const remote = new Map<string, Backup & { hidden: boolean }>();
    let folderId: string | null = null;
    async function list<T>(
      space: "drive" | "appDataFolder",
      query: string,
      fields: string,
    ) {
      const files: T[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      do {
        const params = new URLSearchParams({
          spaces: space,
          q: query,
          pageSize: "100",
          fields: `nextPageToken,files(${fields})`,
        });
        if (cursor) params.set("pageToken", cursor);
        const batch = await request(
          `${api}/files?${params}`,
          {},
          (res) =>
            res.json() as Promise<{ files?: T[]; nextPageToken?: string }>,
        );
        files.push(...(batch.files ?? []));
        cursor = batch.nextPageToken;
        if (cursor && seen.has(cursor))
          throw new Error(
            "Drive returned an incomplete backup listing. Please retry.",
          );
        if (cursor) seen.add(cursor);
      } while (cursor);
      return files;
    }

    let destination: Promise<string> | undefined;
    async function findOrCreateFolder(
      name: string,
      role: string,
      parent: string,
    ) {
      const [existing] = await list<{ id: string }>(
        "drive",
        `trashed = false and mimeType = '${folderMime}' and '${parent}' in parents and appProperties has { key='folioRole' and value='${role}' }`,
        "id",
      );
      if (existing) return existing.id;
      const data = await request(
        `${api}/files?fields=id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            mimeType: folderMime,
            parents: [parent],
            appProperties: { folioRole: role },
          }),
        },
        (res) => res.json() as Promise<{ id: string }>,
      );
      if (!data.id) throw new Error("Drive did not return a backup folder.");
      return data.id;
    }
    function backupFolder() {
      return (destination ??= findOrCreateFolder(
        "Folio",
        "root-v1",
        "root",
      ).then((root) => findOrCreateFolder("Documents", "documents-v1", root)));
    }

    const pdfQuery = "trashed = false and mimeType = 'application/pdf'";
    const fields = "id,name,size,modifiedTime,parents,appProperties";
    // Legacy hidden backups stay readable after upgrading to the visible folder.
    for (const space of ["drive", "appDataFolder"] as const) {
      const query =
        space === "drive"
          ? `${pdfQuery} and appProperties has { key='folioRole' and value='document-v1' }`
          : pdfQuery;
      for (const item of await list<Backup>(space, query, fields)) {
        const hash = item.appProperties?.sha256;
        if (hash && /^[a-f0-9]{64}$/.test(hash) && !remote.has(hash))
          remote.set(hash, { ...item, hidden: space === "appDataFolder" });
        if (space === "drive" && item.parents?.[0])
          folderId ??= item.parents[0];
      }
    }

    const backupFiles = () =>
      Array.from(
        remote.values(),
        ({ id, name, hidden, size, modifiedTime }) => ({
          id,
          name,
          hidden,
          size: Number(size) || 0,
          modifiedTime,
        }),
      );
    if (listOnly) {
      useDriveBackup.setState({ folderId, files: backupFiles(), status: "" });
      return;
    }

    const local = new Set<string>();
    const trash = new Set<string>();
    let uploaded = 0,
      restored = 0,
      failed = 0,
      skipped = 0;
    const docs = [
      ...(await listDocuments()),
      ...(await listDocuments("", true)),
    ];
    for (const [index, doc] of docs.entries()) {
      if (doc.sensitive) continue;
      if (doc.fileSize > maxBytes) {
        if (!doc.deletedAt) skipped++;
        continue;
      }
      useDriveBackup.setState({
        status: `Checking local PDFs ${index + 1} / ${docs.length}`,
      });
      try {
        const owner = await setting<string | null>(
          `driveOwner:${doc.id}`,
          null,
        );
        const cached = await setting<{ uri: string; hash: string } | null>(
          `driveHash:${doc.id}`,
          null,
        );
        const bytes =
          cached?.uri === doc.uri ? undefined : await readBytes(doc.uri);
        const hash = bytes
          ? await sha256(Uint8Array.from(bytes))
          : cached!.hash;
        if (bytes)
          await setSetting(`driveHash:${doc.id}`, { uri: doc.uri, hash });
        if (doc.deletedAt) {
          trash.add(hash);
          continue;
        }
        local.add(hash);
        if (owner && owner !== account.id) {
          skipped++;
          continue;
        }
        if (remote.has(hash)) continue;
        const body = bytes ?? (await readBytes(doc.uri));
        if (!body.length || body.length > maxBytes) {
          skipped++;
          continue;
        }
        await setSetting(`driveOwner:${doc.id}`, account.id);
        const parent = await backupFolder();
        const uploadUrl = await request(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,modifiedTime",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Upload-Content-Type": "application/pdf",
              "X-Upload-Content-Length": String(body.length),
            },
            body: JSON.stringify({
              name: doc.title + ".pdf",
              mimeType: "application/pdf",
              parents: [parent],
              appProperties: { sha256: hash, folioRole: "document-v1" },
            }),
          },
          async (res) => res.headers.get("Location"),
        );
        if (!uploadUrl) throw new Error("Drive upload could not start.");
        const item = await request(
          uploadUrl,
          {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: Uint8Array.from(body),
          },
          (res) => res.json() as Promise<Backup>,
        );
        folderId = parent;
        remote.set(hash, { ...item, hidden: false });
        uploaded++;
      } catch {
        failed++;
      }
    }
    let checked = 0;
    for (const [hash, item] of remote) {
      checked++;
      if (local.has(hash) || trash.has(hash)) continue;
      useDriveBackup.setState({
        status: `Checking Drive PDFs ${checked} / ${remote.size} · ${restored} restored`,
      });
      try {
        const size = Number(item.size);
        if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
          skipped++;
          continue;
        }
        const bytes = await request(
          `${api}/files/${encodeURIComponent(item.id)}?alt=media`,
          {},
          async (res) => new Uint8Array(await res.arrayBuffer()),
        );
        if (bytes.length !== size || (await sha256(bytes)) !== hash)
          throw new Error("Drive copy failed integrity checks.");
        if (
          useDriveBackup.getState().account?.id !== account.id ||
          sdk.getCurrentUser()?.user.id !== account.id
        )
          throw new Error("Google account changed during restore.");
        const doc = await savePdf(item.name.replace(/\.pdf$/i, ""), bytes);
        await setSetting(`driveOwner:${doc.id}`, account.id);
        await setSetting(`driveHash:${doc.id}`, { uri: doc.uri, hash });
        local.add(hash);
        restored++;
        useDriveBackup.setState((state) => ({
          libraryRevision: state.libraryRevision + 1,
        }));
      } catch {
        failed++;
      }
    }
    const lastBackup = failed
      ? useDriveBackup.getState().lastBackup
      : new Date().toISOString();
    useDriveBackup.setState({
      folderId,
      files: backupFiles(),
      lastBackup,
      status: `${remote.size} in Drive · ${uploaded} newly backed up · ${restored} restored${failed ? ` · ${failed} need retry` : ""}${skipped ? ` · ${skipped} skipped` : ""}`,
    });
    if (!failed) await setSetting(`driveLastBackup:${account.id}`, lastBackup);
  } catch (error) {
    useDriveBackup.setState({
      status:
        error instanceof Error
          ? error.message
          : "Drive backup could not finish. Please retry.",
    });
  } finally {
    useDriveBackup.setState({ busy: false });
  }
}
