import { useSyncStatus } from "../../hooks/useAutoSync";
import { useState } from "react";
import { ScrollView, View, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSettings } from "../../store";
import { api, authorized, signOut, useAuth } from "../../features/auth";
import { sync } from "../../features/sync";
import { Button, Label, Card, layout } from "../../components/ui";
import { useTheme } from "../../theme";
import {
  PageHeading,
  Chip,
  SectionHeading,
  IconBadge,
} from "../../components/experience";
export default function Profile() {
  const autoSyncStatus = useSyncStatus((s) => s.message);
  const t = useTheme(),
    settings = useSettings(),
    user = useAuth((s) => s.user),
    [progress, setProgress] = useState(""),
    [subscription, setSubscription] = useState<string | null>(null);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView contentContainerStyle={layout.content}>
        <PageHeading
          eyebrow="Just the way you like it"
          title="Settings"
          subtitle="Your account, your preferences, your privacy."
        />
        <Card>
          <View style={layout.row}>
            <IconBadge icon="person-outline" large />
            <View style={{ flex: 1 }}>
              <Label size={22}>{user?.name ?? "Your local workspace"}</Label>
              <Label muted size={12}>
                {user ? "Folio account" : "No account needed to scan"}
              </Label>
            </View>
          </View>
          <Label muted>
            {user?.email ?? "You’re using Folio privately on this device."}
          </Label>
          {!user ? (
            <Button
              title="Sign in or create account"
              onPress={() => router.push("/login")}
            />
          ) : (
            <Button
              title="Sign out"
              icon="log-out-outline"
              secondary
              onPress={signOut}
            />
          )}
        </Card>
        <Card>
          <SectionHeading title="Cloud backup" icon="cloud-upload-outline" />
          <Label muted>
            When enabled, Folio automatically uploads ordinary documents to your
            account while the app is open. ID scans stay local. Disable backup
            at any time.
          </Label>
          <View style={{ ...layout.row, justifyContent: "space-between" }}>
            <Label>Allow cloud backup</Label>
            <Switch
              accessibilityLabel="Allow cloud backup"
              trackColor={{ false: t.line, true: t.primary }}
              value={settings.backup}
              onValueChange={(v) => {
                if (v && !user) {
                  router.push("/login");
                  return;
                }
                void settings
                  .change("backup", v)
                  .catch((e) =>
                    Alert.alert("Couldn't update backup", String(e)),
                  );
              }}
            />
          </View>
          <Button
            title="Sync now & restore"
            icon="sync-outline"
            secondary
            disabled={!settings.backup}
            onPress={() => sync(setProgress)}
          />
          <Label muted>{progress || autoSyncStatus}</Label>
        </Card>
        <Card>
          <SectionHeading title="Make it yours" icon="color-palette-outline" />
          <Label muted size={12}>
            APPEARANCE
          </Label>
          <View style={layout.wrap}>
            {(["system", "light", "dark"] as const).map((theme) => (
              <Chip
                icon={
                  theme === "dark"
                    ? "moon-outline"
                    : theme === "light"
                      ? "sunny-outline"
                      : "phone-portrait-outline"
                }
                key={theme}
                title={theme[0].toUpperCase() + theme.slice(1)}
                selected={settings.theme === theme}
                onPress={() => {
                  void settings
                    .change("theme", theme)
                    .catch((e) =>
                      Alert.alert("Couldn't save preference", String(e)),
                    );
                }}
              />
            ))}
          </View>
          <Button
            secondary
            icon="options-outline"
            title={`Scan quality: ${settings.quality === 75 ? "Standard" : settings.quality === 90 ? "High" : "Maximum"}`}
            onPress={() =>
              settings.change(
                "quality",
                settings.quality === 75
                  ? 90
                  : settings.quality === 90
                    ? 100
                    : 75,
              )
            }
          />
          <Button
            secondary
            icon="finger-print-outline"
            title={
              settings.lock
                ? "Disable app lock"
                : "Enable biometric / device lock"
            }
            onPress={async () => {
              if (!(await LocalAuthentication.isEnrolledAsync()))
                throw new Error(
                  "Set up a screen lock or biometrics in your device settings first.",
                );
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: settings.lock
                  ? "Disable Folio lock"
                  : "Enable Folio lock",
              });
              if (result.success) await settings.change("lock", !settings.lock);
            }}
          />
        </Card>
        <Card>
          <SectionHeading title="Subscription" icon="sparkles-outline" />
          <Button
            title="Plans & restore purchases"
            icon="sparkles-outline"
            secondary
            onPress={() => router.push("/subscription")}
          />
          <Label muted>
            Local scanning and basic PDF tools are free. View plans to check
            purchase availability for this build.
          </Label>
          {user && (
            <Button
              title="Check verified entitlement"
              secondary
              onPress={async () => {
                const result = await authorized(() =>
                  api.request<{
                    subscription: { plan: string; expiryDate: string } | null;
                  }>("/subscriptions/current"),
                );
                setSubscription(
                  result.subscription
                    ? `${result.subscription.plan} until ${new Date(result.subscription.expiryDate).toLocaleDateString()}`
                    : "Free plan",
                );
              }}
            />
          )}
          {subscription && <Label>{subscription}</Label>}
        </Card>
        <Card>
          <SectionHeading
            title="Privacy, by design"
            icon="shield-checkmark-outline"
          />
          <Label muted>
            Folio stores scans in app-private storage. Cloud backup is optional.
            OCR runs on this device. No document contents are sent to
            advertising or analytics services.
          </Label>
          <Label muted>
            Deleting the app removes local files. Export important documents or
            verify a cloud backup first. App lock protects access through Folio;
            it does not independently encrypt each local PDF.
          </Label>
        </Card>
        {user && (
          <>
            <Button
              title="Export my account data"
              icon="download-outline"
              secondary
              onPress={async () => {
                const data = await authorized(() =>
                  api.request("/auth/export"),
                );
                const uri = `${FS.cacheDirectory}folio-account-export.json`;
                await FS.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
                await Sharing.shareAsync(uri, { mimeType: "application/json" });
              }}
            />
            <Button
              title="Delete cloud account"
              icon="trash-outline"
              danger
              onPress={() =>
                Alert.alert(
                  "Delete your cloud account?",
                  "Your account and cloud files will be queued for permanent deletion. Local files remain on this device.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete cloud account",
                      style: "destructive",
                      onPress: () => {
                        void authorized(() =>
                          api.request("/auth/account", { method: "DELETE" }),
                        )
                          .then(signOut)
                          .catch((e) =>
                            Alert.alert("Deletion failed", String(e)),
                          );
                      },
                    },
                  ],
                )
              }
            />
          </>
        )}
        <Label muted size={12}>
          Folio 0.1.0 · Development build
        </Label>
      </ScrollView>
    </SafeAreaView>
  );
}
