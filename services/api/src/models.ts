import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";
const opts = { timestamps: true, versionKey: false } as const;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    billingAccountToken: { type: String, default: randomUUID },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "deleting"],
      default: "active",
    },
    storageQuota: { type: Number, default: 104857600 },
    storageUsed: { type: Number, default: 0 },
    storageReserved: { type: Number, default: 0 },
  },
  opts,
);
export const User = mongoose.model("User", userSchema);
const docSchema = new Schema(
  {
    _id: String,
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    pageCount: { type: Number, required: true },
    folderId: { type: String, default: null },
    mimeType: { type: String, default: "application/pdf" },
    fileSize: { type: Number, default: 0 },
    cloudObjectReference: String,
    revision: { type: Number, default: 1 },
    favorite: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  opts,
);
docSchema.index({ ownerId: 1, updatedAt: 1, _id: 1 });
export const Document = mongoose.model("Document", docSchema);
export const DocumentPage = mongoose.model(
  "DocumentPage",
  new Schema(
    {
      _id: String,
      documentId: { type: String, index: true, required: true },
      pageIndex: Number,
      originalImageReference: String,
      processedImageReference: String,
      width: Number,
      height: Number,
      rotation: Number,
      filterSettings: Schema.Types.Mixed,
    },
    opts,
  ),
);
export const Folder = mongoose.model(
  "Folder",
  new Schema(
    {
      _id: String,
      ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
      name: { type: String, required: true },
    },
    opts,
  ),
);
export const DeviceSession = mongoose.model(
  "DeviceSession",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      deviceId: String,
      refreshTokenHash: { type: String, unique: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
      lastActiveAt: Date,
      revokedAt: { type: Date, default: null },
      familyId: { type: String, required: true },
    },
    opts,
  ),
);
const subSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    plan: String,
    platform: String,
    storeTransactionReference: { type: String, unique: true },
    status: String,
    expiryDate: Date,
  },
  opts,
);
export const Subscription = mongoose.model("Subscription", subSchema);
const syncSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    key: { type: String, required: true },
    requestHash: String,
    result: Schema.Types.Mixed,
  },
  opts,
);
syncSchema.index({ userId: 1, key: 1 }, { unique: true });
export const SyncOperation = mongoose.model("SyncOperation", syncSchema);
export const AuditLog = mongoose.model(
  "AuditLog",
  new Schema(
    {
      actorId: Schema.Types.ObjectId,
      action: String,
      targetId: String,
      requestId: String,
    },
    opts,
  ),
);
export const Upload = mongoose.model(
  "Upload",
  new Schema(
    {
      _id: String,
      ownerId: { type: Schema.Types.ObjectId, required: true },
      documentId: String,
      key: String,
      fileSize: Number,
      revision: Number,
      state: {
        type: String,
        enum: ["pending", "complete", "aborted"],
        default: "pending",
      },
      expiresAt: Date,
    },
    opts,
  ),
);
