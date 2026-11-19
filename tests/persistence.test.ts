import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rename,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
const state = vi.hoisted(() => ({ root: "", failWrite: false }));
let sql: DatabaseSync;
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (s: string) => {
      sql.exec(s);
    },
    getFirstAsync: async (s: string, ...args: SQLInputValue[]) =>
      sql.prepare(s).get(...args),
    getAllAsync: async (s: string, ...args: SQLInputValue[]) =>
      sql.prepare(s).all(...args),
    runAsync: async (s: string, ...args: SQLInputValue[]) =>
      sql.prepare(s).run(...args),
    withExclusiveTransactionAsync: async (
      fn: (tx: unknown) => Promise<void>,
    ) => {
      sql.exec("BEGIN");
      try {
        await fn({
          getFirstAsync: async (s: string, ...args: SQLInputValue[]) =>
            sql.prepare(s).get(...args),
          runAsync: async (s: string, ...args: SQLInputValue[]) =>
            sql.prepare(s).run(...args),
        });
        sql.exec("COMMIT");
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  }),
}));
vi.mock("expo-crypto", () => ({ randomUUID }));
vi.mock("expo-file-system/legacy", () => ({
  get documentDirectory() {
    return `${state.root}/`;
  },
  EncodingType: { Base64: "base64" },
  makeDirectoryAsync: (p: string) => mkdir(p, { recursive: true }),
  copyAsync: ({ from, to }: { from: string; to: string }) => copyFile(from, to),
  moveAsync: ({ from, to }: { from: string; to: string }) => rename(from, to),
  deleteAsync: (p: string) => rm(p, { recursive: true, force: true }),
  writeAsStringAsync: async (p: string, data: string) => {
    if (state.failWrite) throw new Error("Disk is full");
    await writeFile(p, Buffer.from(data, "base64"));
  },
  readAsStringAsync: async (p: string) =>
    (await readFile(p)).toString("base64"),
}));
beforeEach(async () => {
  vi.resetModules();
  state.failWrite = false;
  if (sql) sql.close();
  sql = new DatabaseSync(":memory:");
  if (state.root) await rm(state.root, { recursive: true, force: true });
  state.root = await mkdtemp(join(tmpdir(), "folio-test-"));
});
afterAll(async () => {
  sql.close();
  await rm(state.root, { recursive: true, force: true });
});
async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Offline document");
  return pdf.save();
}
describe("SQLite and filesystem document lifecycle", () => {
  it("writes real PDF bytes, survives module reload, and indexes OCR text", async () => {
    const repo = await import("../apps/mobile/database");
    const bytes = await fixture();
    const doc = await repo.savePdf("Local original", bytes);
    expect(await readFile(doc.uri)).toEqual(Buffer.from(bytes));
    await repo.updateDocument(doc.id, { text: "invoice number 123" });
    vi.resetModules();
    const reopened = await import("../apps/mobile/database");
    expect((await reopened.listDocuments("invoice"))[0].id).toBe(doc.id);
    expect((await reopened.getDocument(doc.id))?.pageCount).toBe(1);
  });
  it("keeps originals safe across duplicate, trash and restore", async () => {
    const repo = await import("../apps/mobile/database");
    const original = await repo.savePdf("Original", await fixture());
    const duplicate = await repo.duplicateDocument(original);
    expect(duplicate.id).not.toBe(original.id);
    await repo.updateDocument(original.id, {
      deletedAt: new Date().toISOString(),
    });
    expect(await repo.listDocuments()).toHaveLength(1);
    expect(await repo.listDocuments("", true)).toHaveLength(1);
    await repo.updateDocument(original.id, { deletedAt: null });
    expect(await repo.listDocuments()).toHaveLength(2);
    expect((await readFile(original.uri)).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  });
  it("rolls back an incomplete disk write without creating a phantom document", async () => {
    const repo = await import("../apps/mobile/database");
    await repo.db();
    state.failWrite = true;
    await expect(repo.savePdf("Will fail", await fixture())).rejects.toThrow(
      "Disk is full",
    );
    expect(await repo.listDocuments()).toHaveLength(0);
    expect(await readdir(repo.root)).toHaveLength(0);
  });
  it("updates the outbox with the current revision and treats wildcard search literally", async () => {
    const repo = await import("../apps/mobile/database");
    const doc = await repo.savePdf("100% complete", await fixture());
    await repo.savePdf("Another file", await fixture());
    await repo.updateDocument(doc.id, { favorite: true });
    expect(await repo.listDocuments("%")).toHaveLength(1);
    expect((await repo.listDocuments(" 100% complete "))[0].id).toBe(doc.id);
    expect(
      sql.prepare("SELECT revision FROM outbox WHERE documentId=?").get(doc.id)
        ?.revision,
    ).toBe(2);
  });
  it("does not overwrite edits made during an upload or remove their queued revision", async () => {
    const repo = await import("../apps/mobile/database");
    const doc = await repo.savePdf("Original", await fixture());
    await repo.updateDocument(doc.id, { title: "Edited during upload" });
    await repo.markSync(doc.id, 5, "synced", doc.revision);
    const latest = await repo.getDocument(doc.id);
    expect(latest?.title).toBe("Edited during upload");
    expect(latest?.syncState).toBe("pending");
    expect(latest?.remoteRevision).toBe(5);
    expect(
      sql.prepare("SELECT revision FROM outbox WHERE documentId=?").get(doc.id)
        ?.revision,
    ).toBe(2);
    await repo.markSync(doc.id, 6, "synced", 2);
    expect((await repo.getDocument(doc.id))?.syncState).toBe("synced");
    expect(
      sql.prepare("SELECT * FROM outbox WHERE documentId=?").get(doc.id),
    ).toBeUndefined();
  });
});

it("persists the unfiltered edit base independently of temporary cache files", async () => {
  const repo = await import("../apps/mobile/database");
  const source = join(state.root, "source.jpg"),
    base = join(state.root, "cropped.jpg"),
    processed = join(state.root, "bw.jpg");
  await writeFile(source, "original pixels");
  await writeFile(base, "cropped color pixels");
  await writeFile(processed, "black white pixels");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const saved = await repo.savePdf("Editable", await pdf.save(), [
    {
      id: "p",
      originalUri: source,
      uri: processed,
      editBaseUri: base,
      width: 100,
      height: 100,
      rotation: 0,
      filter: "bw",
    },
  ]);
  await rm(base);
  const reopened = await repo.getDocument(saved.id);
  expect(await readFile(reopened!.pages[0].editBaseUri!, "utf8")).toBe(
    "cropped color pixels",
  );
  expect(await readFile(reopened!.pages[0].uri, "utf8")).toBe(
    "black white pixels",
  );
});
