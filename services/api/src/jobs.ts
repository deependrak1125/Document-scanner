import { Queue, Worker } from "bullmq";
import mongoose from "mongoose";
import { config } from "./config.js";
import {
  User,
  DeviceSession,
  Document,
  DocumentPage,
  Folder,
  Subscription,
  SyncOperation,
  Upload,
  AuditLog,
} from "./models.js";
import { removeObject, removeUserObjects } from "./storage.js";
import { logger } from "./app.js";
const redis = new URL(config.REDIS_URL);
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
};
export const queue = new Queue("folio-maintenance", { connection });
export async function enqueueDeletion(userId: string) {
  await queue.add(
    "delete-account",
    { userId },
    {
      jobId: `delete-${userId}`,
      attempts: 10,
      backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}
export const worker = new Worker(
  "folio-maintenance",
  async (job) => {
    if (job.name === "delete-account") {
      const { userId } = job.data as { userId: string };
      await User.updateOne({ _id: userId }, { accountStatus: "deleting" });
      await removeUserObjects(userId);
      await mongoose.connection.transaction(async (session) => {
        const ids = await Document.find({ ownerId: userId })
          .distinct("_id")
          .session(session);
        await DocumentPage.deleteMany(
          { documentId: { $in: ids } },
          { session },
        );
        await Document.deleteMany({ ownerId: userId }, { session });
        await Folder.deleteMany({ ownerId: userId }, { session });
        await Upload.deleteMany({ ownerId: userId }, { session });
        await DeviceSession.deleteMany({ userId }, { session });
        await Subscription.deleteMany({ userId }, { session });
        await SyncOperation.deleteMany({ userId }, { session });
        await AuditLog.deleteMany({ actorId: userId }, { session });
        await User.deleteOne({ _id: userId }, { session });
      });
    } else {
      for (const upload of await Upload.find({
        state: "pending",
        expiresAt: { $lt: new Date() },
      }).limit(100)) {
        await removeObject(upload.key!);
        await mongoose.connection.transaction(async (session) => {
          const claimed = await Upload.findOneAndUpdate(
            { _id: upload._id, state: "pending" },
            { state: "aborted" },
            { session },
          );
          if (claimed)
            await User.updateOne(
              { _id: upload.ownerId },
              { $inc: { storageReserved: -upload.fileSize! } },
              { session },
            );
        });
      }
      const expired = await Subscription.find({
        status: "active",
        expiryDate: { $lt: new Date() },
      });
      for (const sub of expired) {
        await Subscription.updateOne({ _id: sub._id }, { status: "expired" });
        if (
          !(await Subscription.exists({
            userId: sub.userId,
            status: "active",
            expiryDate: { $gt: new Date() },
          }))
        )
          await User.updateOne(
            { _id: sub.userId },
            { storageQuota: 104857600 },
          );
      }
    }
  },
  { connection, concurrency: 2 },
);
worker.on("failed", (job) =>
  logger.error({ jobId: job?.id }, "Maintenance job failed"),
);
export async function startJobs() {
  await queue.upsertJobScheduler(
    "cleanup",
    { every: 300000 },
    { name: "cleanup", data: {} },
  );
}
