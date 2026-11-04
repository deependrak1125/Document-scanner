import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z
    .string()
    .default("mongodb://localhost:27017/folio?replicaSet=rs0"),
  JWT_SECRET: z.string().min(32),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5173"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("folio"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_PACKAGE_NAME: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT: z.string().optional(),
  PREMIUM_PRODUCT_IDS: z.string().default("folio.premium.monthly"),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_ISSUER_ID: z.string().optional(),
  APPLE_BUNDLE_ID: z.string().optional(),
  APPLE_APP_ID: z.coerce.number().int().positive().optional(),
  APPLE_PRIVATE_KEY_BASE64: z.string().optional(),
  APPLE_ROOT_CA_PATHS: z.string().optional(),
  APPLE_ENVIRONMENT: z.enum(["Sandbox", "Production"]).default("Production"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE: z.string().optional(),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  config.JWT_SECRET.includes("development")
)
  throw new Error("Replace the development JWT secret.");

if (
  config.NODE_ENV === "production" &&
  config.APPLE_ENVIRONMENT !== "Production"
)
  throw new Error(
    "Sandbox purchases cannot authorize production subscriptions.",
  );
