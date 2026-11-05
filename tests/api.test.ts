import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { randomUUID } from "node:crypto";
vi.mock("../services/api/src/storage", () => ({
  putUrl: vi.fn(async () => "https://storage.test/upload"),
  getUrl: vi.fn(async () => "https://storage.test/download"),
  validatePdf: vi.fn(async () => undefined),
  removeObject: vi.fn(async () => undefined),
  copyObject: vi.fn(async () => undefined),
}));
import { createApp } from "../services/api/src/app";
import { User, Document, Upload } from "../services/api/src/models";
let mongo: MongoMemoryReplSet;
const app = createApp();
const pass = "correct horse battery staple";
async function register(email = "reader@example.com") {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: pass, name: "Reader" });
  expect(res.status).toBe(201);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
async function document(token: string) {
  const id = randomUUID();
  const res = await request(app)
    .post("/api/v1/documents")
    .set(auth(token))
    .send({ id, title: "Private scan", pageCount: 2 });
  expect(res.status).toBe(201);
  return id;
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections))
    await collection.deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("authenticated API integration", () => {
  it("validates registration and never exposes password hashes", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .send({ email: "bad", password: "short" })
      ).status,
    ).toBe(400);
    const user = await register();
    const me = await request(app)
      .get("/api/v1/auth/me")
      .set(auth(user.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.passwordHash).toBeUndefined();
    expect(
      (
        await request(app).post("/api/v1/auth/login").send({
          email: "reader@example.com",
          password: "wrong password length",
        })
      ).status,
    ).toBe(401);
  });
  it("rotates refresh tokens and revokes the family on replay", async () => {
    const user = await register();
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).not.toBe(user.refreshToken);
    expect(
      (await request(app).get("/api/v1/auth/me").set(auth(user.accessToken)))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/refresh")
          .send({ refreshToken: user.refreshToken })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/v1/auth/me")
          .set(auth(refresh.body.accessToken))
      ).status,
    ).toBe(401);
  });
  it("blocks cross-account document access and admin APIs", async () => {
    const a = await register(),
      b = await register("other@example.com");
    const id = await document(a.accessToken);
    for (const path of [`/documents/${id}`, `/documents/${id}/download`])
      expect(
        (
          await request(app)
            .get("/api/v1" + path)
            .set(auth(b.accessToken))
        ).status,
      ).toBe(404);
    expect(
      (
        await request(app)
          .get("/api/v1/admin/dashboard")
          .set(auth(a.accessToken))
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/v1/documents")).status).toBe(401);
  });
  it("enforces revisions, trash and restore", async () => {
    const a = await register(),
      id = await document(a.accessToken);
    expect(
      (
        await request(app)
          .patch(`/api/v1/documents/${id}`)
          .set(auth(a.accessToken))
          .send({ revision: 1, title: "Renamed" })
      ).body.revision,
    ).toBe(2);
    expect(
      (
        await request(app)
          .patch(`/api/v1/documents/${id}`)
          .set(auth(a.accessToken))
          .send({ revision: 1, title: "Stale" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete(`/api/v1/documents/${id}`)
          .set(auth(a.accessToken))
          .send({ revision: 2 })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/v1/documents").set(auth(a.accessToken)))
        .body.items,
    ).toHaveLength(0);
    expect(
      (
        await request(app)
          .post(`/api/v1/documents/${id}/restore`)
          .set(auth(a.accessToken))
          .send({ revision: 3 })
      ).body.deletedAt,
    ).toBeNull();
  });
  it("rejects foreign folders and untrusted object keys", async () => {
    const a = await register(),
      b = await register("other@example.com");
    const folderId = randomUUID();
    await request(app)
      .post("/api/v1/folders")
      .set(auth(a.accessToken))
      .send({ id: folderId, name: "Private" });
    expect(
      (
        await request(app)
          .post("/api/v1/documents")
          .set(auth(b.accessToken))
          .send({ id: randomUUID(), title: "X", pageCount: 1, folderId })
      ).status,
    ).toBe(404);
  });
  it("validates upload MIME, size, ownership and reserves quota transactionally", async () => {
    const a = await register(),
      id = await document(a.accessToken);
    expect(
      (
        await request(app)
          .post("/api/v1/uploads/initiate")
          .set(auth(a.accessToken))
          .send({
            documentId: id,
            fileSize: 10,
            mimeType: "text/html",
            revision: 1,
          })
      ).status,
    ).toBe(400);
    await User.updateOne({ _id: a.user.id }, { storageQuota: 100 });
    const upload = await request(app)
      .post("/api/v1/uploads/initiate")
      .set(auth(a.accessToken))
      .send({
        documentId: id,
        fileSize: 80,
        mimeType: "application/pdf",
        revision: 1,
      });
    expect(upload.status).toBe(201);
    expect(
      (
        await request(app)
          .post("/api/v1/uploads/initiate")
          .set(auth(a.accessToken))
          .send({
            documentId: id,
            fileSize: 80,
            mimeType: "application/pdf",
            revision: 1,
          })
      ).status,
    ).toBe(413);
    expect((await User.findById(a.user.id))?.storageReserved).toBe(80);
    await request(app)
      .post("/api/v1/uploads/abort")
      .set(auth(a.accessToken))
      .send({ uploadId: upload.body.uploadId });
    expect((await User.findById(a.user.id))?.storageReserved).toBe(0);
    expect((await Upload.findById(upload.body.uploadId))?.state).toBe(
      "aborted",
    );
  });
  it("paginates sync changes without losing ties and validates cursors", async () => {
    const a = await register();
    const ids = [
      await document(a.accessToken),
      await document(a.accessToken),
      await document(a.accessToken),
    ];
    const at = new Date("2026-01-01");
    await Document.updateMany(
      {},
      { $set: { updatedAt: at } },
      { timestamps: false },
    );
    const first = await request(app)
      .get("/api/v1/sync/changes?limit=2")
      .set(auth(a.accessToken));
    const second = await request(app)
      .get(`/api/v1/sync/changes?limit=2&cursor=${first.body.cursor}`)
      .set(auth(a.accessToken));
    expect(
      [...first.body.items, ...second.body.items]
        .map((d: { id: string }) => d.id)
        .sort(),
    ).toEqual(ids.sort());
    expect(
      (
        await request(app)
          .get("/api/v1/sync/changes?cursor=garbage")
          .set(auth(a.accessToken))
      ).status,
    ).toBe(400);
  });
  it("replays idempotent sync operations without a second revision increment", async () => {
    const a = await register(),
      id = await document(a.accessToken);
    const body = {
      key: randomUUID(),
      id,
      patch: { revision: 1, title: "Changed" },
    };
    const first = await request(app)
      .post("/api/v1/sync/push")
      .set(auth(a.accessToken))
      .send(body);
    expect(first.status).toBe(200);
    const second = await request(app)
      .post("/api/v1/sync/push")
      .set(auth(a.accessToken))
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.revision).toBe(2);
    expect(
      (
        await request(app)
          .post("/api/v1/sync/push")
          .set(auth(a.accessToken))
          .send({ ...body, patch: { revision: 1, title: "Different" } })
      ).status,
    ).toBe(409);
  });
  it("does not accept client payment success or claim unavailable account deletion", async () => {
    const a = await register();
    expect(
      (
        await request(app)
          .post("/api/v1/subscriptions/verify")
          .set(auth(a.accessToken))
          .send({ success: true })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/subscriptions/verify")
          .set(auth(a.accessToken))
          .send({
            platform: "ios",
            productId: "folio.premium.monthly",
            purchaseToken: "untrusted",
          })
      ).status,
    ).toBe(503);
    expect(
      (
        await request(app)
          .delete("/api/v1/auth/account")
          .set(auth(a.accessToken))
      ).status,
    ).toBe(503);
  });
});

it("protects Office conversion with authentication, per-file consent and an enable flag", async () => {
  const previous = process.env.OFFICE_CONVERSION_ENABLED;
  try {
    process.env.OFFICE_CONVERSION_ENABLED = "true";
    expect(
      (
        await request(app)
          .post("/api/v1/office/convert")
          .set("Content-Type", "application/octet-stream")
          .send(Buffer.from("PKtest"))
      ).status,
    ).toBe(401);
    const account = await register("office-tests@example.com");
    expect(
      (
        await request(app)
          .post("/api/v1/office/convert")
          .set(auth(account.accessToken))
          .set("Content-Type", "application/octet-stream")
          .send(Buffer.from("PKtest"))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/office/convert")
          .set(auth(account.accessToken))
          .set("X-Folio-Consent", "upload-for-processing")
          .set("X-Folio-Format", "exe")
          .set("Content-Type", "application/octet-stream")
          .send(Buffer.from("PKtest"))
      ).status,
    ).toBe(400);
    process.env.OFFICE_CONVERSION_ENABLED = "false";
    expect(
      (
        await request(app)
          .post("/api/v1/office/convert")
          .set(auth(account.accessToken))
          .set("Content-Type", "application/octet-stream")
          .send(Buffer.from("PKtest"))
      ).status,
    ).toBe(503);
  } finally {
    if (previous === undefined) delete process.env.OFFICE_CONVERSION_ENABLED;
    else process.env.OFFICE_CONVERSION_ENABLED = previous;
  }
});
