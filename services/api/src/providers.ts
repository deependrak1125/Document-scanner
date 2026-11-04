import {
  AppStoreServerAPIClient,
  SignedDataVerifier,
  Environment,
} from "@apple/app-store-server-library";
import { readFile } from "node:fs/promises";
import { GoogleAuth } from "google-auth-library";
import { config } from "./config.js";
import { HttpError } from "./security.js";
import type { PurchaseVerifier } from "@folio/shared-types";
export const purchaseVerifier: PurchaseVerifier = {
  async verify(input) {
    if (!config.PREMIUM_PRODUCT_IDS.split(",").includes(input.productId))
      throw new HttpError(422, "Unknown subscription product.");
    if (input.platform === "ios") {
      if (
        !config.APPLE_KEY_ID ||
        !config.APPLE_ISSUER_ID ||
        !config.APPLE_BUNDLE_ID ||
        !config.APPLE_PRIVATE_KEY_BASE64 ||
        !config.APPLE_ROOT_CA_PATHS ||
        (config.APPLE_ENVIRONMENT === "Production" && !config.APPLE_APP_ID)
      )
        throw new HttpError(503, "Apple verification is not configured.");
      const environment =
        config.APPLE_ENVIRONMENT === "Production"
          ? Environment.PRODUCTION
          : Environment.SANDBOX;
      const roots = await Promise.all(
        config.APPLE_ROOT_CA_PATHS.split(",").map((p) => readFile(p.trim())),
      );
      const verifier = new SignedDataVerifier(
        roots,
        true,
        environment,
        config.APPLE_BUNDLE_ID,
        config.APPLE_APP_ID,
      );
      const client = new AppStoreServerAPIClient(
        Buffer.from(config.APPLE_PRIVATE_KEY_BASE64, "base64").toString(),
        config.APPLE_KEY_ID,
        config.APPLE_ISSUER_ID,
        config.APPLE_BUNDLE_ID,
        environment,
      );
      try {
        const claimed = await verifier.verifyAndDecodeTransaction(
          input.purchaseToken,
        );
        if (!claimed.transactionId) throw new Error("Missing transaction");
        const response = await client.getTransactionInfo(claimed.transactionId);
        if (!response.signedTransactionInfo)
          throw new Error("Missing transaction");
        const transaction = await verifier.verifyAndDecodeTransaction(
          response.signedTransactionInfo,
        );
        if (
          transaction.productId !== input.productId ||
          transaction.appAccountToken !== input.accountToken ||
          transaction.revocationDate ||
          !transaction.expiresDate ||
          transaction.expiresDate <= Date.now() ||
          !transaction.originalTransactionId
        )
          throw new Error("Inactive entitlement");
        return {
          transactionId: `apple:${transaction.originalTransactionId}`,
          expiresAt: new Date(transaction.expiresDate),
          productId: transaction.productId,
        };
      } catch {
        throw new HttpError(
          422,
          "Apple could not verify an active purchase for this account.",
        );
      }
    }
    if (!config.GOOGLE_SERVICE_ACCOUNT || !config.GOOGLE_PACKAGE_NAME)
      throw new HttpError(
        503,
        "Store verification is not configured for this platform.",
      );
    const auth = new GoogleAuth({
      credentials: JSON.parse(config.GOOGLE_SERVICE_ACCOUNT) as object,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const client = await auth.getClient();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.GOOGLE_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`;
    const { data } = await client.request<{
      subscriptionState: string;
      latestOrderId: string;
      externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
      lineItems: { productId: string; expiryTime: string }[];
    }>({ url });
    const item = data.lineItems?.find((i) => i.productId === input.productId);
    if (
      !item ||
      data.externalAccountIdentifiers?.obfuscatedExternalAccountId !==
        input.accountId ||
      ![
        "SUBSCRIPTION_STATE_ACTIVE",
        "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
        "SUBSCRIPTION_STATE_CANCELED",
      ].includes(data.subscriptionState) ||
      new Date(item.expiryTime).getTime() <= Date.now()
    )
      throw new HttpError(422, "No active purchase was verified.");
    // Token hash is stable across renewals; order IDs are not.
    const { hash } = await import("./security.js");
    return {
      transactionId: hash(input.purchaseToken),
      expiresAt: new Date(item.expiryTime),
      productId: item.productId,
    };
  },
};
export async function otp(phone: string, code?: string) {
  if (
    !config.TWILIO_ACCOUNT_SID ||
    !config.TWILIO_AUTH_TOKEN ||
    !config.TWILIO_VERIFY_SERVICE
  )
    throw new HttpError(503, "Phone authentication is not configured.");
  const body = new URLSearchParams(
    code ? { To: phone, Code: code } : { To: phone, Channel: "sms" },
  );
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SERVICE}/${code ? "VerificationCheck" : "Verifications"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new HttpError(502, "Phone verification provider failed.");
  const result = (await response.json()) as { status: string };
  if (code && result.status !== "approved")
    throw new HttpError(401, "Invalid or expired code.");
}
