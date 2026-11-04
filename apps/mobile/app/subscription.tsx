import { Screen } from "../components/Screen";
import { useEffect, useState, useRef } from "react";
import { ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import {
  useIAP,
  getAvailablePurchases,
  finishTransaction,
  type Purchase,
} from "react-native-iap";
import { api, authorized, useAuth } from "../features/auth";
import { Button, Label, Card, layout } from "../components/ui";
export default function SubscriptionScreen() {
  return (
    <Screen>
      <SubscriptionScreenContent />
    </Screen>
  );
}
function SubscriptionScreenContent() {
  if (process.env.EXPO_PUBLIC_BILLING_ENABLED !== "true")
    return (
      <ScrollView contentContainerStyle={layout.content}>
        <Label size={28}>Keep scanning, freely.</Label>
        <Label muted>
          Core scanning and local PDF tools are free. Store subscriptions are
          disabled for this build until store products, signing, and server
          verification are configured.
        </Label>
      </ScrollView>
    );
  return <Store />;
}
function Store() {
  const user = useAuth((s) => s.user),
    [message, setMessage] = useState(""),
    [ids, setIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  async function verify(purchase: Purchase, restore = false) {
    if (pending.current.has(purchase.id)) return;
    pending.current.add(purchase.id);
    try {
      if (!purchase.purchaseToken || purchase.purchaseState !== "purchased")
        throw new Error("The store purchase is still pending.");
      setMessage("Verifying with the store…");
      const result = await authorized(() =>
        api.post<{ plan: string; expiresAt: string }>(
          `/subscriptions/${restore ? "restore" : "verify"}`,
          {
            platform: Platform.OS,
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
          },
        ),
      );
      await finishTransaction({ purchase, isConsumable: false });
      setMessage(
        `${result.plan} verified until ${new Date(result.expiresAt).toLocaleDateString()}.`,
      );
    } finally {
      pending.current.delete(purchase.id);
    }
  }
  const { connected, subscriptions, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void verify(purchase).catch((e) =>
        setMessage(
          e instanceof Error
            ? e.message
            : "Verification failed. Use Restore to retry.",
        ),
      );
    },
    onPurchaseError: (error) => setMessage(error.message),
    onError: (error) => setMessage(error.message),
  });
  useEffect(() => {
    void api
      .request<{ plans: { id: string; productIds?: string[] }[] }>(
        "/subscriptions/plans",
      )
      .then((result) =>
        setIds(result.plans.find((p) => p.id === "premium")?.productIds ?? []),
      )
      .catch((e) => setMessage(String(e)));
  }, []);
  useEffect(() => {
    if (connected && ids.length)
      void fetchProducts({ skus: ids, type: "subs" }).catch((e) =>
        setMessage(String(e)),
      );
  }, [connected, ids, fetchProducts]);
  if (!user)
    return (
      <ScrollView contentContainerStyle={layout.content}>
        <Label>Sign in to bind your purchase to your account.</Label>
        <Button title="Sign in" onPress={() => router.push("/login")} />
      </ScrollView>
    );
  return (
    <ScrollView contentContainerStyle={layout.content}>
      <Label size={30}>More room for your documents.</Label>
      <Label muted>
        Premium includes 10 GB of cloud storage. Scanning and local PDF tools
        remain free. Prices and renewal terms come from your device’s store.
      </Label>
      {subscriptions.map((product) => (
        <Card key={product.id}>
          <Label size={20}>{product.title}</Label>
          <Label muted>{product.description}</Label>
          <Label>{product.displayPrice}</Label>
          <Button
            title={`Subscribe · ${product.displayPrice}`}
            disabled={!connected}
            onPress={async () => {
              const offers = product.subscriptionOffers ?? [];
              const offer = offers.find((o) => o.offerTokenAndroid);
              if (Platform.OS === "android" && !offer?.offerTokenAndroid)
                throw new Error(
                  "No eligible billing plan was returned by Google Play.",
                );
              await requestPurchase({
                type: "subs",
                request: {
                  apple: {
                    sku: product.id,
                    appAccountToken: user.billingAccountToken,
                  },
                  google: {
                    skus: [product.id],
                    obfuscatedAccountId: user.id,
                    subscriptionOffers: offer?.offerTokenAndroid
                      ? [
                          {
                            sku: product.id,
                            offerToken: offer.offerTokenAndroid,
                          },
                        ]
                      : undefined,
                  },
                },
              });
            }}
          />
        </Card>
      ))}
      {!subscriptions.length && (
        <Label muted>
          {connected
            ? "No configured store products are currently available."
            : "Connecting to your device’s store…"}
        </Label>
      )}
      <Button
        title="Restore & verify purchases"
        secondary
        disabled={!connected}
        onPress={async () => {
          const purchases = await getAvailablePurchases();
          const matches = purchases.filter((p) => ids.includes(p.productId));
          if (!matches.length) {
            setMessage("No purchases to restore for this store account.");
            return;
          }
          for (const purchase of matches) await verify(purchase, true);
        }}
      />
      {message && <Label>{message}</Label>}
      <Label muted size={12}>
        Subscriptions renew according to the store’s displayed terms. Manage or
        cancel in your App Store or Google Play account. Purchases unlock
        storage only after backend verification.
      </Label>
    </ScrollView>
  );
}
