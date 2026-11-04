import * as SQLite from "expo-sqlite";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import type { LocalDocument, ScanPage } from "@folio/shared-types";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
export const root = `${FS.documentDirectory}folio/`;
export async function db() {
  return (database ??= (async () => {
    const d = await SQLite.openDatabaseAsync("folio.db");
    await d.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT, folderId TEXT, favorite INTEGER NOT NULL DEFAULT 0, ocrText TEXT NOT NULL DEFAULT '');
 CREATE INDEX IF NOT EXISTS document_date ON documents(updatedAt);
 CREATE TABLE IF NOT EXISTS folders(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(documentId TEXT PRIMARY KEY, revision INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT);
 PRAGMA user_version=1;`);
    await FS.makeDirectoryAsync(root, { intermediates: true });
    return d;
  })());
}
export async function setting<T>(key: string, fallback: T): Promise<T> {
  const row = await (
    await db()
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key=?",
    key,
  );
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",
    key,
    JSON.stringify(value),
  );
}
export async function listDocuments(
  query = "",
  trash = false,
  sort: "date" | "name" | "size" = "date",
) {
  const rows = await (
    await db()
  ).getAllAsync<{ data: string }>(
    `SELECT data FROM documents WHERE deletedAt IS ${trash ? "NOT " : ""}NULL AND (title LIKE ? ESCAPE '\\' OR ocrText LIKE ? ESCAPE '\\') ORDER BY ${sort === "name" ? "title COLLATE NOCASE" : "updatedAt DESC"}`,
    ...Array(2).fill(`%${query.replace(/[\\%_]/g, "\\$&")}%`),
  );
  const docs = rows.map((r) => JSON.parse(r.data) as LocalDocument);
  return sort === "size" ? docs.sort((a, b) => b.fileSize - a.fileSize) : docs;
}
export async function getDocument(id: string) {
  const row = await (
    await db()
  ).getFirstAsync<{ data: string }>(
    "SELECT data FROM documents WHERE id=?",
    id,
  );
  return row ? (JSON.parse(row.data) as LocalDocument) : null;
}
export async function persist(doc: LocalDocument, queue = true) {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      "INSERT OR REPLACE INTO documents(id,title,data,updatedAt,deletedAt,folderId,favorite,ocrText) VALUES(?,?,?,?,?,?,?,?)",
      doc.id,
      doc.title,
      JSON.stringify(doc),
      doc.updatedAt,
      doc.deletedAt,
      doc.folderId,
      doc.favorite ? 1 : 0,
      doc.text,
    );
    if (queue)
      await tx.runAsync(
        "INSERT OR REPLACE INTO outbox(documentId,revision) VALUES(?,?)",
        doc.id,
        doc.revision,
      );
  });
}
export async function updateDocument(
  id: string,
  patch: Partial<
    Pick<
      LocalDocument,
      "title" | "favorite" | "folderId" | "deletedAt" | "text" | "pages"
    >
  >,
) {
  const doc = await getDocument(id);
  if (!doc) throw new Error("Document not found.");
  const next = {
    ...doc,
    ...patch,
    revision: doc.revision + 1,
    updatedAt: new Date().toISOString(),
    syncState: "pending" as const,
  };
  await persist(next);
  return next;
}
export async function savePdf(
  title: string,
  bytes: Uint8Array,
  pages: ScanPage[] = [],
  sensitive = false,
) {
  const { fromByteArray } = await import("base64-js");
  const id = Crypto.randomUUID(),
    dir = `${root}${id}/`;
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  try {
    const stored: ScanPage[] = [];
    for (const [i, p] of pages.entries()) {
      const originalUri = `${dir}${i}-original.jpg`,
        uri = `${dir}${i}-processed.jpg`;
      await FS.copyAsync({ from: p.originalUri, to: originalUri });
      await FS.copyAsync({ from: p.uri, to: uri });
      const editBaseUri = `${dir}${i}-base.jpg`;
      await FS.copyAsync({ from: p.editBaseUri ?? p.uri, to: editBaseUri });
      stored.push({ ...p, originalUri, uri, editBaseUri });
    }
    const uri = `${dir}document.pdf`,
      temp = `${dir}document.tmp`;
    await FS.writeAsStringAsync(temp, fromByteArray(bytes), {
      encoding: FS.EncodingType.Base64,
    });
    await FS.moveAsync({ from: temp, to: uri });
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);
    const now = new Date().toISOString();
    const doc: LocalDocument = {
      id,
      title: title.trim() || "Untitled document",
      uri,
      pages: stored,
      pageCount: pdf.getPageCount(),
      fileSize: bytes.length,
      favorite: false,
      folderId: null,
      revision: 1,
      remoteRevision: 0,
      syncState: "local",
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      text: stored.map((p) => p.text ?? "").join("\n\n"),
      sensitive,
    };
    await persist(doc);
    return doc;
  } catch (error) {
    await FS.deleteAsync(dir, { idempotent: true }).catch(() => {});
    throw error;
  }
}
export async function duplicateDocument(doc: LocalDocument) {
  return savePdf(
    `${doc.title} copy`,
    await readBytes(doc.uri),
    doc.pages,
    doc.sensitive,
  );
}
export async function readBytes(uri: string) {
  const { toByteArray } = await import("base64-js");
  return toByteArray(
    await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 }),
  );
}
export async function folders() {
  return (await db()).getAllAsync<{ id: string; name: string }>(
    "SELECT * FROM folders ORDER BY name",
  );
}
export async function createFolder(name: string) {
  if (!name.trim()) throw new Error("Enter a folder name.");
  await (
    await db()
  ).runAsync(
    "INSERT INTO folders(id,name) VALUES(?,?)",
    Crypto.randomUUID(),
    name.trim(),
  );
}

// Update only synchronization fields while retaining edits made during a transfer.
export async function markSync(
  id: string,
  remoteRevision: number,
  status: LocalDocument["syncState"],
  uploadedRevision?: number,
) {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ data: string }>(
      "SELECT data FROM documents WHERE id=?",
      id,
    );
    if (!row) return;
    const current = JSON.parse(row.data) as LocalDocument;
    const next = {
      ...current,
      remoteRevision,
      syncState:
        uploadedRevision !== undefined && current.revision !== uploadedRevision
          ? ("pending" as const)
          : status,
    };
    await tx.runAsync(
      "UPDATE documents SET data=? WHERE id=?",
      JSON.stringify(next),
      id,
    );
    if (uploadedRevision !== undefined)
      await tx.runAsync(
        "DELETE FROM outbox WHERE documentId=? AND revision=?",
        id,
        uploadedRevision,
      );
  });
}
