import { FolioBrand, FolioIllustration } from "../../components/FolioBrand";
import { useSyncStatus } from "../../hooks/useAutoSync";
import { useCallback, useState } from "react";
import { ScrollView, View, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDocuments } from "../../database";
import { router, useFocusEffect } from "expo-router";
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
  Disclosure,
  IconBadge,
} from "../../components/experience";
export default function Profile() {
  const autoSyncStatus = useSyncStatus((s) => s.message);
  const t = useTheme(),
    settings = useSettings(),
    user = useAuth((s) => s.user),
    [progress, setProgress] = useState(""),
    [subscription, setSubscription] = useState<string | null>(null);
  const [storage, setStorage] = useState<{
    count: number;
    bytes: number;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listDocuments()
        .then((docs) => {
          if (active)
            setStorage({
              count: docs.length,
              bytes: docs.reduce((sum, d) => sum + d.fileSize, 0),
            });
        })
        .catch(() => {
          if (active) setStorage(null);
        });
      return () => {
        active = false;
      };
    }, []),
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView contentContainerStyle={layout.content}>
        <FolioBrand />
        <View style={layout.row}>
          <View style={{ flex: 1 }}>
            <PageHeading
              title="Profile"
              subtitle="Your documents. Your preferences."
            />
          </View>
          <FolioIllustration kind="profile" />
        </View>
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
          <View style={{ ...layout.row, justifyContent: "space-between" }}>
            <View>
              <Label size={24}>{storage?.count ?? "—"}</Label>
              <Label muted size={12}>
                Saved documents
              </Label>
            </View>
            <View>
              <Label size={24}>
                {storage ? `${(storage.bytes / 1048576).toFixed(1)} MB` : "—"}
              </Label>
              <Label muted size={12}>
                PDF storage on device
              </Label>
            </View>
          </View>
          <Button
            title="Open my documents"
            icon="folder-open-outline"
            secondary
            onPress={() => router.push("/(tabs)/documents")}
          />
        </Card>
        <Label size={19}>Settings</Label>
        <Disclosure
          title="Cloud backup"
          icon="cloud-upload-outline"
          description="Optional backup · ID scans stay on device"
        >
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
        </Disclosure>
        <Disclosure
          title="Appearance & security"
          icon="color-palette-outline"
          description="Theme, scan quality and app lock"
        >
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
        </Disclosure>
        <Disclosure
          title="Plan & purchases"
          icon="sparkles-outline"
          description="Check your plan or restore purchases"
        >
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
        </Disclosure>
        <Disclosure
          title="Privacy & storage"
          icon="shield-checkmark-outline"
          description="Understand where your documents are stored"
        >
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
        </Disclosure>
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
          Folio · Made for your documents
        </Label>
      </ScrollView>
    </SafeAreaView>
  );
}
