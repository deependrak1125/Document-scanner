import openapi from "./openapi.json" with { type: "json" };
import { pdfTools } from "./pdf-tools.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import pino from "pino";
import mongoose from "mongoose";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { OAuth2Client } from "google-auth-library";
import {
  registration,
  credentials,
  documentInput,
  documentPatch,
  uploadInput,
  folderInput,
  purchaseInput,
  pageQuery,
} from "@folio/validation";
import { config } from "./config.js";
import {
  User,
  DeviceSession,
  Document,
  Folder,
  Upload,
  Subscription,
  AuditLog,
  SyncOperation,
} from "./models.js";
import {
  authenticate,
  admin,
  identity,
  issueTokens,
  hash,
  HttpError,
} from "./security.js";
import {
  putUrl,
  getUrl,
  validatePdf,
  removeObject,
  copyObject,
} from "./storage.js";
import { otp, purchaseVerifier } from "./providers.js";
export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
});
const publicUser = (u: InstanceType<typeof User>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  billingAccountToken: u.billingAccountToken,
  storageUsed: u.storageUsed,
  storageQuota: u.storageQuota,
});
export const publicDoc = (d: InstanceType<typeof Document>) => ({
  id: d._id,
  title: d.title,
  pageCount: d.pageCount,
  fileSize: d.fileSize,
  favorite: d.favorite,
  folderId: d.folderId,
  revision: d.revision,
  deletedAt: d.deletedAt,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  mimeType: d.mimeType,
});
export function createApp(
  dependencies: { enqueueDeletion?: (id: string) => Promise<void> } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.ADMIN_ORIGIN }));
  app.use(express.json({ limit: "256kb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      serializers: {
        req: (r) => ({
          id: r.id,
          method: r.method,
          path: String(r.url)
            .split("?")[0]
            .replace(/\/[0-9a-f-]{24,}/gi, "/:id"),
        }),
        res: (r) => ({ statusCode: r.statusCode }),
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.get("/health", (_req, res) =>
    res.json({
      status: mongoose.connection.readyState === 1 ? "ok" : "degraded",
    }),
  );
  const api = express.Router();
  app.use("/api/v1", api);
  api.use(
    "/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: config.NODE_ENV === "test" ? 100 : 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  api.post("/auth/register", async (req, res) => {
    const input = registration.parse(req.body);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await argon2.hash(input.password),
    });
    res.status(201).json({
      user: publicUser(user),
      ...(await issueTokens(user.id, "mobile")),
    });
  });
  api.post("/auth/login", async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await User.findOne({ email: input.email }).select(
      "+passwordHash",
    );
    if (
      !user?.passwordHash ||
      !(await argon2.verify(user.passwordHash, input.password)) ||
      user.accountStatus !== "active"
    )
      throw new HttpError(401, "Email or password is incorrect.");
    res.json({
      user: publicUser(user),
      ...(await issueTokens(user.id, "client")),
    });
  });
  api.post("/auth/google", async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID)
      throw new HttpError(503, "Google sign-in is not configured.");
    const { idToken } = z
      .object({ idToken: z.string().max(10000) })
      .parse(req.body);
    let payload;
    try {
      payload = (
        await new OAuth2Client(config.GOOGLE_CLIENT_ID).verifyIdToken({
          idToken,
          audience: config.GOOGLE_CLIENT_ID,
        })
      ).getPayload();
    } catch {
      throw new HttpError(401, "Invalid Google identity.");
    }
    if (!payload?.email_verified || !payload.email)
      throw new HttpError(401, "Google email must be verified.");
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      if (await User.exists({ email: payload.email }))
        throw new HttpError(
          409,
          "Sign in with your existing method before linking Google.",
        );
      user = await User.create({
        email: payload.email,
        name: payload.name ?? "Folio user",
        googleId: payload.sub,
      });
    }
    if (user.accountStatus !== "active")
      throw new HttpError(403, "Account unavailable.");
    res.json({
      user: publicUser(user),
      ...(await issueTokens(user.id, "google")),
    });
  });
  api.post("/auth/refresh", async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(32).max(200) })
      .parse(req.body);
    const tokenHash = hash(refreshToken);
    let tokens: Awaited<ReturnType<typeof issueTokens>> | undefined;
    await mongoose.connection.transaction(async (mongoSession) => {
      const session = await DeviceSession.findOneAndUpdate(
        {
          refreshTokenHash: tokenHash,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { revokedAt: new Date() },
        { new: false, session: mongoSession },
      );
      if (!session) return;
      const user = await User.findById(session.userId).session(mongoSession);
      if (!user || user.accountStatus !== "active")
        throw new HttpError(401, "Account unavailable.");
      tokens = await issueTokens(
        user.id,
        session.deviceId ?? "client",
        session.familyId,
        mongoSession,
      );
    });
    if (!tokens) {
      const reused = await DeviceSession.findOne({
        refreshTokenHash: tokenHash,
      });
      if (reused)
        await DeviceSession.updateMany(
          { familyId: reused.familyId },
          { revokedAt: new Date() },
        );
      throw new HttpError(401, "Refresh token is expired or was already used.");
    }
    res.json(tokens);
  });
  api.post("/auth/otp/request", async (req, res) => {
    const { phone } = z
      .object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) })
      .parse(req.body);
    await otp(phone);
    res.status(202).json({ message: "Verification requested." });
  });
  api.post("/auth/otp/verify", async (req, res) => {
    const { phone, code } = z
      .object({
        phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
        code: z.string().regex(/^\d{4,8}$/),
      })
      .parse(req.body);
    await otp(phone, code);
    const user = await User.findOneAndUpdate(
      { phone },
      { $setOnInsert: { name: "Folio user", phone } },
      { upsert: true, new: true },
    );
    if (user.accountStatus !== "active")
      throw new HttpError(403, "Account unavailable.");
    res.json({
      user: publicUser(user),
      ...(await issueTokens(user.id, "phone")),
    });
  });
  api.get("/subscriptions/plans", (_req, res) =>
    res.json({
      plans: [
        { id: "free", storageBytes: 104857600, localScanning: true },
        {
          id: "premium",
          storageBytes: 10737418240,
          productIds: config.PREMIUM_PRODUCT_IDS.split(","),
        },
      ],
    }),
  );
  api.use(authenticate);
  api.use("/pdf", pdfTools);
  api.get("/auth/me", async (req, res) =>
    res.json(publicUser((await User.findById(identity(req).userId))!)),
  );
  api.post("/auth/logout", async (req, res) => {
    await DeviceSession.updateOne(
      { _id: identity(req).sessionId },
      { revokedAt: new Date() },
    );
    res.status(204).end();
  });
  api.get("/auth/sessions", async (req, res) =>
    res.json(
      await DeviceSession.find({
        userId: identity(req).userId,
        revokedAt: null,
      }).select("deviceId lastActiveAt createdAt"),
    ),
  );
  api.delete("/auth/account", async (req, res) => {
    if (!dependencies.enqueueDeletion)
      throw new HttpError(503, "Account deletion worker unavailable.");
    const id = identity(req).userId;
    await dependencies.enqueueDeletion(id);
    await User.updateOne({ _id: id }, { accountStatus: "deleting" });
    await DeviceSession.updateMany({ userId: id }, { revokedAt: new Date() });
    res.status(202).json({ status: "deletion-queued" });
  });
  api.get("/auth/export", async (req, res) => {
    const ownerId = identity(req).userId;
    res.json({
      user: publicUser((await User.findById(ownerId))!),
      documents: (await Document.find({ ownerId })).map(publicDoc),
      folders: await Folder.find({ ownerId }).select("_id name"),
      subscriptions: await Subscription.find({ userId: ownerId }).select(
        "plan platform status expiryDate",
      ),
    });
  });
  const getOwned = async (ownerId: string, id: string) => {
    const doc = await Document.findOne({ _id: id, ownerId });
    if (!doc) throw new HttpError(404, "Document not found.");
    return doc;
  };
  const checkFolder = async (ownerId: string, id?: string | null) => {
    if (id && !(await Folder.exists({ _id: id, ownerId })))
      throw new HttpError(404, "Folder not found.");
  };
  api.get("/documents", async (req, res) => {
    const { limit, offset } = pageQuery.parse(req.query);
    const ownerId = identity(req).userId;
    const rows = await Document.find({ ownerId, deletedAt: null })
      .sort({ updatedAt: -1, _id: 1 })
      .skip(offset)
      .limit(limit);
    res.json({ items: rows.map(publicDoc), offset, limit });
  });
  api.post("/documents", async (req, res) => {
    const input = documentInput.parse(req.body);
    const ownerId = identity(req).userId;
    await checkFolder(ownerId, input.folderId);
    const existing = await Document.findById(input.id);
    if (existing) {
      if (String(existing.ownerId) !== ownerId)
        throw new HttpError(409, "Document ID unavailable.");
      res.json(publicDoc(existing));
      return;
    }
    const doc = await Document.create({ ...input, _id: input.id, ownerId });
    res.status(201).json(publicDoc(doc));
  });
  api.get("/documents/:id", async (req, res) =>
    res.json(
      publicDoc(await getOwned(identity(req).userId, String(req.params.id))),
    ),
  );
  api.patch("/documents/:id", async (req, res) => {
    const { revision, ...patch } = documentPatch.parse(req.body);
    const ownerId = identity(req).userId;
    await checkFolder(ownerId, patch.folderId);
    const doc = await Document.findOneAndUpdate(
      { _id: req.params.id, ownerId, revision },
      { $set: patch, $inc: { revision: 1 } },
      { new: true },
    );
    if (!doc) {
      await getOwned(ownerId, String(req.params.id));
      throw new HttpError(409, "Document changed on another device.");
    }
    res.json(publicDoc(doc));
  });
  for (const action of ["delete", "restore"] as const) {
    const handler: express.RequestHandler = async (req, res) => {
      const { revision } = z
        .object({ revision: z.number().int().positive() })
        .parse(req.body);
      const ownerId = identity(req).userId;
      const doc = await Document.findOneAndUpdate(
        { _id: req.params.id, ownerId, revision },
        {
          $set: { deletedAt: action === "delete" ? new Date() : null },
          $inc: { revision: 1 },
        },
        { new: true },
      );
      if (!doc) {
        await getOwned(ownerId, String(req.params.id));
        throw new HttpError(409, "Document revision conflict.");
      }
      res.json(publicDoc(doc));
    };
    if (action === "delete") api.delete("/documents/:id", handler);
    else api.post("/documents/:id/restore", handler);
  }
  api.post("/documents/:id/duplicate", async (req, res) => {
    const ownerId = identity(req).userId;
    const source = await getOwned(ownerId, String(req.params.id));
    if (!source.cloudObjectReference)
      throw new HttpError(409, "Upload the source file before duplicating.");
    const id = randomUUID(),
      key = `${ownerId}/${id}/verified-${randomUUID()}.pdf`;
    await copyObject(source.cloudObjectReference, key);
    try {
      await mongoose.connection.transaction(async (session) => {
        const user = await User.findOneAndUpdate(
          {
            _id: ownerId,
            $expr: {
              $lte: [
                { $add: ["$storageUsed", "$storageReserved", source.fileSize] },
                "$storageQuota",
              ],
            },
          },
          { $inc: { storageUsed: source.fileSize } },
          { session, new: true },
        );
        if (!user) throw new HttpError(413, "Cloud storage quota exceeded.");
        await Document.create(
          [
            {
              _id: id,
              ownerId,
              title: `${source.title} copy`,
              pageCount: source.pageCount,
              folderId: source.folderId,
              fileSize: source.fileSize,
              cloudObjectReference: key,
            },
          ],
          { session },
        );
      });
    } catch (error) {
      await removeObject(key).catch(() => {});
      throw error;
    }
    res.status(201).json(publicDoc(await getOwned(ownerId, id)));
  });
  api.get("/documents/:id/download", async (req, res) => {
    const doc = await getOwned(identity(req).userId, String(req.params.id));
    if (!doc.cloudObjectReference)
      throw new HttpError(404, "No cloud file is available.");
    res.json({ url: await getUrl(doc.cloudObjectReference) });
  });
  api.get("/folders", async (req, res) =>
    res.json({
      items: await Folder.find({ ownerId: identity(req).userId })
        .sort({ name: 1 })
        .limit(500),
    }),
  );
  api.post("/folders", async (req, res) => {
    const input = folderInput.parse(req.body);
    res.status(201).json(
      await Folder.create({
        _id: input.id,
        name: input.name,
        ownerId: identity(req).userId,
      }),
    );
  });
  api.patch("/folders/:id", async (req, res) => {
    const { name } = folderInput.pick({ name: true }).parse(req.body);
    const row = await Folder.findOneAndUpdate(
      { _id: req.params.id, ownerId: identity(req).userId },
      { name },
      { new: true },
    );
    if (!row) throw new HttpError(404, "Folder not found.");
    res.json(row);
  });
  api.delete("/folders/:id", async (req, res) => {
    const ownerId = identity(req).userId;
    await mongoose.connection.transaction(async (session) => {
      const folder = await Folder.findOneAndDelete(
        { _id: req.params.id, ownerId },
        { session },
      );
      if (!folder) throw new HttpError(404, "Folder not found.");
      await Document.updateMany(
        { ownerId, folderId: req.params.id },
        { $set: { folderId: null }, $inc: { revision: 1 } },
        { session },
      );
    });
    res.status(204).end();
  });
  api.post("/uploads/initiate", async (req, res) => {
    const input = uploadInput.parse(req.body),
      ownerId = identity(req).userId;
    const doc = await getOwned(ownerId, input.documentId);
    if (doc.revision !== input.revision)
      throw new HttpError(409, "Document revision conflict.");
    const id = randomUUID(),
      key = `${ownerId}/${input.documentId}/${id}.pdf`;
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findOneAndUpdate(
        {
          _id: ownerId,
          $expr: {
            $lte: [
              { $add: ["$storageUsed", "$storageReserved", input.fileSize] },
              "$storageQuota",
            ],
          },
        },
        { $inc: { storageReserved: input.fileSize } },
        { session, new: true },
      );
      if (!user) throw new HttpError(413, "Cloud storage quota exceeded.");
      await Upload.create(
        [
          {
            _id: id,
            ownerId,
            documentId: input.documentId,
            key,
            fileSize: input.fileSize,
            revision: input.revision,
            expiresAt: new Date(Date.now() + 3600000),
          },
        ],
        { session },
      );
    });
    res.status(201).json({
      uploadId: id,
      url: await putUrl(key, input.fileSize),
      headers: {
        "Content-Type": "application/pdf",
        "x-amz-server-side-encryption": "AES256",
      },
      expiresIn: 900,
    });
  });
  api.post("/uploads/complete", async (req, res) => {
    const { uploadId } = z
        .object({ uploadId: z.string().uuid() })
        .parse(req.body),
      ownerId = identity(req).userId;
    const upload = await Upload.findOne({ _id: uploadId, ownerId });
    if (!upload) throw new HttpError(404, "Upload not found.");
    if (upload.state === "complete") {
      res.json(publicDoc(await getOwned(ownerId, upload.documentId!)));
      return;
    }
    if (upload.state !== "pending" || upload.expiresAt! < new Date())
      throw new HttpError(410, "Upload expired.");
    const etag = await validatePdf(upload.key!, upload.fileSize!);
    const finalKey = `${ownerId}/${upload.documentId}/verified-${randomUUID()}.pdf`;
    await copyObject(upload.key!, finalKey, etag);
    let oldKey: string | undefined;
    await mongoose.connection.transaction(async (session) => {
      const claimed = await Upload.findOneAndUpdate(
        { _id: uploadId, state: "pending" },
        { $set: { state: "complete" } },
        { session },
      );
      if (!claimed) throw new HttpError(409, "Upload already finalized.");
      const doc = await Document.findOneAndUpdate(
        { _id: upload.documentId, ownerId, revision: upload.revision },
        {
          $set: { cloudObjectReference: finalKey, fileSize: upload.fileSize },
          $inc: { revision: 1 },
        },
        { session, new: false },
      );
      if (!doc) throw new HttpError(409, "Document changed during upload.");
      oldKey = doc.cloudObjectReference ?? undefined;
      await User.updateOne(
        { _id: ownerId },
        {
          $inc: {
            storageReserved: -upload.fileSize!,
            storageUsed: upload.fileSize! - (doc.fileSize ?? 0),
          },
        },
        { session },
      );
    });
    await removeObject(upload.key!).catch(() =>
      logger.warn("Staging object cleanup deferred"),
    );
    if (oldKey)
      await removeObject(oldKey).catch(() =>
        logger.warn("Superseded object cleanup deferred"),
      );
    res.json(publicDoc(await getOwned(ownerId, upload.documentId!)));
  });
  api.post("/uploads/abort", async (req, res) => {
    const { uploadId } = z
        .object({ uploadId: z.string().uuid() })
        .parse(req.body),
      ownerId = identity(req).userId;
    let key: string | undefined;
    await mongoose.connection.transaction(async (session) => {
      const upload = await Upload.findOneAndUpdate(
        { _id: uploadId, ownerId, state: "pending" },
        { state: "aborted" },
        { session },
      );
      if (upload) {
        key = upload.key ?? undefined;
        await User.updateOne(
          { _id: ownerId },
          { $inc: { storageReserved: -upload.fileSize! } },
          { session },
        );
      }
    });
    if (key) await removeObject(key);
    res.status(204).end();
  });
  api.get("/sync/changes", async (req, res) => {
    const { limit } = pageQuery.parse(req.query);
    let cursor: { time: string; id: string } = {
      time: "1970-01-01T00:00:00.000Z",
      id: "",
    };
    if (req.query.cursor) {
      try {
        cursor = z
          .object({ time: z.string().datetime(), id: z.string().max(100) })
          .parse(
            JSON.parse(
              Buffer.from(String(req.query.cursor), "base64url").toString(),
            ),
          );
      } catch {
        throw new HttpError(400, "Invalid sync cursor.");
      }
    }
    const rows = await Document.find({
      ownerId: identity(req).userId,
      $or: [
        { updatedAt: { $gt: new Date(cursor.time) } },
        { updatedAt: new Date(cursor.time), _id: { $gt: cursor.id } },
      ],
    })
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit);
    const last = rows.at(-1);
    res.json({
      items: rows.map(publicDoc),
      cursor: last
        ? Buffer.from(
            JSON.stringify({
              time: last.updatedAt.toISOString(),
              id: last._id,
            }),
          ).toString("base64url")
        : (req.query.cursor ?? null),
      hasMore: rows.length === limit,
    });
  });
  api.post("/sync/push", async (req, res) => {
    const input = z
      .object({
        key: z.string().uuid(),
        id: z.string().uuid(),
        patch: documentPatch,
      })
      .parse(req.body);
    const userId = identity(req).userId,
      requestHash = hash(JSON.stringify(input));
    let result: unknown;
    await mongoose.connection.transaction(async (session) => {
      const existing = await SyncOperation.findOne({
        userId,
        key: input.key,
      }).session(session);
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new HttpError(
            409,
            "Idempotency key reused for another operation.",
          );
        result = existing.result;
        return;
      }
      const { revision, ...patch } = input.patch;
      await checkFolder(userId, patch.folderId);
      const doc = await Document.findOneAndUpdate(
        { _id: input.id, ownerId: userId, revision },
        { $set: patch, $inc: { revision: 1 } },
        { session, new: true },
      );
      if (!doc)
        throw new HttpError(
          409,
          "Sync conflict. Pull the latest revision before resolving.",
        );
      result = publicDoc(doc);
      await SyncOperation.create(
        [{ userId, key: input.key, requestHash, result }],
        { session },
      );
    });
    res.json(result);
  });
  api.post("/sync/conflicts/resolve", async (req, res) => {
    const { id, patch } = z
      .object({ id: z.string().uuid(), patch: documentPatch })
      .parse(req.body);
    const { revision, ...values } = patch;
    await checkFolder(identity(req).userId, values.folderId);
    const doc = await Document.findOneAndUpdate(
      { _id: id, ownerId: identity(req).userId, revision },
      { $set: values, $inc: { revision: 1 } },
      { new: true },
    );
    if (!doc)
      throw new HttpError(409, "Conflict changed. Refresh before retrying.");
    res.json(publicDoc(doc));
  });
  api.get("/subscriptions/current", async (req, res) =>
    res.json({
      subscription: await Subscription.findOne({
        userId: identity(req).userId,
        status: "active",
        expiryDate: { $gt: new Date() },
      })
        .sort({ expiryDate: -1 })
        .select("plan platform status expiryDate"),
    }),
  );
  for (const route of ["verify", "restore"])
    api.post(`/subscriptions/${route}`, async (req, res) => {
      const input = purchaseInput.parse(req.body),
        verified = await purchaseVerifier.verify({
          ...input,
          accountId: identity(req).userId,
          accountToken: (await User.findById(identity(req).userId))!
            .billingAccountToken!,
        }),
        userId = identity(req).userId;
      await mongoose.connection.transaction(async (session) => {
        const existing = await Subscription.findOne({
          storeTransactionReference: verified.transactionId,
        }).session(session);
        if (existing && String(existing.userId) !== userId)
          throw new HttpError(409, "Purchase belongs to another account.");
        await Subscription.findOneAndUpdate(
          { storeTransactionReference: verified.transactionId },
          {
            $set: {
              userId,
              plan: "premium",
              platform: input.platform,
              status: "active",
              expiryDate: verified.expiresAt,
            },
          },
          { upsert: true, session },
        );
        await User.updateOne(
          { _id: userId },
          { storageQuota: 10737418240 },
          { session },
        );
      });
      res.json({ plan: "premium", expiresAt: verified.expiresAt });
    });
  api.use("/admin", admin);
  api.get("/admin/dashboard", async (_req, res) => {
    const [users, documents, subscriptions, storage, failedUploads, newUsers] =
      await Promise.all([
        User.countDocuments(),
        Document.countDocuments({ deletedAt: null }),
        Subscription.countDocuments({
          status: "active",
          expiryDate: { $gt: new Date() },
        }),
        User.aggregate([
          { $group: { _id: null, total: { $sum: "$storageUsed" } } },
        ]),
        Upload.countDocuments({ state: "aborted" }),
        User.countDocuments({
          createdAt: { $gt: new Date(Date.now() - 30 * 86400000) },
        }),
      ]);
    res.json({
      users,
      documents,
      subscriptions,
      storageBytes: storage[0]?.total ?? 0,
      failedUploads,
      newUsers,
      revenue: null,
    });
  });
  api.get("/admin/users", async (req, res) => {
    const { limit, offset } = pageQuery.parse(req.query);
    const search = z
      .string()
      .max(100)
      .parse(req.query.search ?? "");
    const query = search
      ? {
          email: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        }
      : {};
    res.json({
      items: await User.find(query)
        .select(
          "name email role accountStatus storageUsed storageQuota createdAt",
        )
        .sort({ _id: -1 })
        .skip(offset)
        .limit(limit),
    });
  });
  api.patch("/admin/users/:id", async (req, res) => {
    const { accountStatus } = z
      .object({ accountStatus: z.enum(["active", "suspended"]) })
      .parse(req.body);
    if (String(req.params.id) === identity(req).userId)
      throw new HttpError(422, "Cannot suspend your own admin account.");
    await mongoose.connection.transaction(async (session) => {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { accountStatus },
        { session },
      );
      if (!user) throw new HttpError(404, "User not found.");
      if (accountStatus === "suspended")
        await DeviceSession.updateMany(
          { userId: user._id },
          { revokedAt: new Date() },
          { session },
        );
      await AuditLog.create(
        [
          {
            actorId: identity(req).userId,
            action: `user.${accountStatus}`,
            targetId: req.params.id,
          },
        ],
        { session },
      );
    });
    res.status(204).end();
  });
  api.get("/admin/subscriptions", async (req, res) => {
    const { limit, offset } = pageQuery.parse(req.query);
    res.json({
      items: await Subscription.find()
        .select("userId plan platform status expiryDate")
        .skip(offset)
        .limit(limit),
    });
  });
  api.get("/admin/documents/stats", async (_req, res) =>
    res.json(
      await Document.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            bytes: { $sum: "$fileSize" },
            pages: { $sum: "$pageCount" },
          },
        },
      ]),
    ),
  );
  api.get("/admin/analytics", async (_req, res) =>
    res.json({
      registrations: await User.aggregate([
        {
          $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    }),
  );
  api.get("/admin/system-health", async (_req, res) =>
    res.json({
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      pendingUploads: await Upload.countDocuments({ state: "pending" }),
      expiredUploads: await Upload.countDocuments({
        state: "pending",
        expiresAt: { $lt: new Date() },
      }),
      uptimeSeconds: Math.floor(process.uptime()),
    }),
  );
  app.use((_req, _res, next) => next(new HttpError(404, "Route not found.")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: { message: "Invalid JSON." } });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({
          error: { message: "Invalid request.", details: error.flatten() },
        });
        return;
      }
      if (error instanceof HttpError) {
        res
          .status(error.status)
          .json({ error: { message: error.message, details: error.details } });
        return;
      }
      if (error instanceof mongoose.Error.CastError) {
        res.status(400).json({ error: { message: "Invalid identifier." } });
        return;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res
          .status(409)
          .json({ error: { message: "This record already exists." } });
        return;
      }
      logger.error(
        { errorType: error instanceof Error ? error.name : "unknown" },
        "Request failed",
      );
      res.status(500).json({
        error: { message: "The server could not complete this request." },
      });
    },
  );
  return app;
}
