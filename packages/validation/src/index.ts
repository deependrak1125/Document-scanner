import { z } from "zod";
export const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const registration = credentials.extend({
  name: z.string().trim().min(1).max(100),
});
export const documentInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  pageCount: z.number().int().min(1).max(500),
  favorite: z.boolean().default(false),
  folderId: z.string().uuid().nullable().default(null),
});
export const documentPatch = documentInput
  .omit({ id: true })
  .partial()
  .extend({ revision: z.number().int().positive() });
export const uploadInput = z.object({
  documentId: z.string().uuid(),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
  mimeType: z.literal("application/pdf"),
  revision: z.number().int().positive(),
});
export const folderInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});
export const purchaseInput = z.object({
  platform: z.enum(["android", "ios"]),
  productId: z.string().min(1).max(200),
  purchaseToken: z.string().min(1).max(10000),
});
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
