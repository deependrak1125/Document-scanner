export type SyncState = "local" | "pending" | "synced" | "conflict";
export type Filter =
  | "original"
  | "grayscale"
  | "bw"
  | "enhanced"
  | "color"
  | "clean"
  | "soft"
  | "sharpen";
export interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ScanPage {
  id: string;
  originalUri: string;
  editBaseUri?: string;
  brightness?: number;
  contrast?: number;
  uri: string;
  width: number;
  height: number;
  rotation: number;
  filter: Filter;
  text?: string;
  words?: OcrWord[];
}
export interface LocalDocument {
  id: string;
  title: string;
  uri: string;
  pages: ScanPage[];
  pageCount: number;
  fileSize: number;
  favorite: boolean;
  folderId: string | null;
  revision: number;
  remoteRevision: number;
  syncState: SyncState;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  text: string;
  sensitive: boolean;
}
export interface CloudDocument {
  id: string;
  title: string;
  pageCount: number;
  fileSize: number;
  favorite: boolean;
  folderId: string | null;
  revision: number;
  deletedAt: string | null;
  updatedAt: string;
  mimeType: "application/pdf";
}
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: "user" | "admin";
  billingAccountToken: string;
  storageUsed: number;
  storageQuota: number;
}
export interface PurchaseVerifier {
  verify(input: {
    platform: "android" | "ios";
    productId: string;
    purchaseToken: string;
    accountId: string;
    accountToken: string;
  }): Promise<{ transactionId: string; expiresAt: Date; productId: string }>;
}
