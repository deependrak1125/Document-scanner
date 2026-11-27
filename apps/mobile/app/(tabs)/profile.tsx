import { launchScanner } from "../../features/scanner/launch";
import mobileLicenses from "../../components/mobileDependencyLicenses.json";
import { SoftwareLicense } from "../../components/SoftwareLicense";
import { AboutFolio } from "../../components/AboutFolio";
import { PrivacyPolicy } from "../../components/PrivacyPolicy";
import { AppearanceSettings } from "../../components/AppearanceSettings";
import { folioServerEnabled } from "../../features/auth/serverMode";
import { useDriveBackup } from "../../features/drive";
import { DriveBackupPanel } from "../../components/DriveBackupPanel";
import { exportLibraryPdfs } from "../../features/documents/export";
import { restoreLibraryPdfs } from "../../features/documents/import";
import {
  FillGradient,
  HomeWaves,
  ScanArtwork,
} from "../../components/HomeArtwork";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import Constants from "expo-constants";
import { useSyncStatus } from "../../hooks/useAutoSync";
import { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Switch,
  Alert,
  Linking,
  Share,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  folioScanFolderName,
  listDocuments,
  scanFolderSettings,
  setting,
  setSetting,
} from "../../database";
import { router, useFocusEffect } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSettings } from "../../store";
import { api, authorized, signOut, useAuth } from "../../features/auth";
import { sync } from "../../features/sync";
import { Button, Label, Card, Field, layout } from "../../components/ui";
import { useTheme } from "../../theme";
import { Chip, Disclosure } from "../../components/experience";
type Panel =
  | "profile"
  | "drive"
  | "appearance"
  | "scan"
  | "about"
  | "search"
  | "privacy"
  | "license"
  | "security"
  | "licenses"
  | "fullPrivacy"
  | "appInfo";
type Icon = React.ComponentProps<typeof Ionicons>["name"];

const playListing =
  "https://play.google.com/store/apps/details?id=com.foliodocument.app&pcampaignid=web_share";
const companyWebsite = "https://nextzenitsolution.in/";

async function openExternal(url: string, message: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Could not open link", message);
  }
}

export default function Profile() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [localName, setLocalName] = useState("Folio User");
  const [nameDraft, setNameDraft] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const [settingsSearch, setSettingsSearch] = useState("");
  const [scanFolders, setScanFolders] = useState<
    { id: string; name: string }[]
  >([]);
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);
  const drive = useDriveBackup();
  const [transfer, setTransfer] = useState("");
  const autoSyncStatus = useSyncStatus((s) => s.message);
  const t = useTheme(),
    settings = useSettings(),
    user = useAuth((s) => s.user),
    [progress, setProgress] = useState(""),
    [subscription, setSubscription] = useState<string | null>(null);
  const [storage, setStorage] = useState<{
    count: number;
    pdfs: number;
    bytes: number;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void scanFolderSettings()
        .then(({ items, folderId }) => {
          if (active) {
            setScanFolders(items);
            setDefaultFolder(folderId);
          }
        })
        .catch(() => {});
      void listDocuments()
        .then((docs) => {
          if (active)
            setStorage({
              count: docs.length,
              pdfs: docs.filter((document) => !!document.uri).length,
              bytes: docs.reduce((sum, d) => sum + d.fileSize, 0),
            });
        })
        .catch(() => {
          if (active) setStorage(null);
        });
      void setting("localProfileName", "Folio User")
        .then((value) => {
          if (active) setLocalName(value);
        })
        .catch(() => {});
      void setting("profileBackupAlerts", true)
        .then((value) => {
          if (active) setAlerts(value);
        })
        .catch(() => {});
      void FS.getFreeDiskStorageAsync()
        .then((value) => {
          if (active) setFreeBytes(value);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [drive.libraryRevision]),
  );
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  const rateFolio = () =>
    openExternal(playListing, "Please try opening Folio on Google Play again.");
  const narrow = width < 360;
  const available =
    storage && freeBytes !== null ? storage.bytes + freeBytes : null;
  const percent =
    storage && available ? Math.min(100, (storage.bytes / available) * 100) : 0;
  const mb = (bytes: number) => (bytes / 1048576).toFixed(1);
  const name = user?.name ?? localName;
  const panelTitle: Record<Panel, string> = {
    profile: "Profile details",
    drive: "Google Drive Backup",
    appearance: "Appearance",
    scan: "Scan Settings",
    about: "About Folio",
    appInfo: "App Info",
    license: "Software License Agreement",
    security: "App Lock",
    licenses: "Open Source Licenses",
    privacy: "Privacy & Security",
    fullPrivacy: "Privacy Policy",
    search: "Search settings",
  };

  function row(
    title: string,
    description: string,
    icon: Icon,
    tint: string,
    color: string,
    open?: () => void,
    trailing?: React.ReactNode,
    divider = false,
    driveIcon = false,
  ) {
    const content = (
      <>
        <View
          style={[styles.badge, { backgroundColor: t.dark ? t.tint : tint }]}
        >
          {driveIcon ? (
            <Svg width={26} height={26} viewBox="0 0 32 32">
              <Path fill="#00a760" d="M10 3h9L7 25l-5-8Z" />
              <Path fill="#ffbc00" d="M10 3h9l12 20h-9Z" />
              <Path fill="#2684fc" d="M7 25l5-8h16l4 0-5 9H7Z" />
            </Svg>
          ) : (
            <Ionicons
              name={icon}
              size={23}
              color={t.dark ? t.primary : color}
            />
          )}
        </View>
        <View
          style={[
            styles.rowCopy,
            divider && { borderBottomWidth: 1, borderColor: t.line },
          ]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{description}</Text>
          </View>
          {trailing ?? (
            <Ionicons name="chevron-forward" size={19} color={t.muted} />
          )}
        </View>
      </>
    );
    return open ? (
      <Pressable
        key={title}
        accessibilityRole="button"
        onPress={open}
        style={styles.row}
      >
        {content}
      </Pressable>
    ) : (
      <View style={styles.row}>{content}</View>
    );
  }

  const lockPromptOpen = useRef(false);
  async function changeAppLock(value: boolean) {
    if (lockPromptOpen.current) return;
    lockPromptOpen.current = true;
    try {
      if (
        value &&
        (await LocalAuthentication.getEnrolledLevelAsync()) ===
          LocalAuthentication.SecurityLevel.NONE
      ) {
        Alert.alert(
          "Set up device authentication",
          "Add a fingerprint, face, or screen lock in device settings first.",
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: value ? "Enable Folio lock" : "Disable Folio lock",
      });
      if (result.success) await settings.change("lock", value);
    } catch {
      Alert.alert("Couldn't update app lock", "Please try again.");
    } finally {
      lockPromptOpen.current = false;
    }
  }

  function shareFolio() {
    void Share.share({
      message: `Folio – Document Scanner & PDF Editor\n${playListing}`,
    }).catch(() => Alert.alert("Couldn't share Folio", "Please try again."));
  }

  function emailSupport() {
    void openExternal(
      "mailto:info@nextzenitsolution.in?subject=Folio%20support",
      "You can email info@nextzenitsolution.in for help.",
    );
  }

  const preferenceRows = [
    [
      "appearance",
      "Theme and app style",
      "color-palette-outline",
      "#ede5ff",
      "#6915dc",
    ],
    [
      "scan",
      "Default scan options and quality",
      "scan-outline",
      "#e6f1ff",
      "#0065ec",
    ],
  ] as const;
  const deviceCard = { backgroundColor: t.surface, borderColor: t.line };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {!t.dark && <FillGradient colors={["#dceaff", "#f2f5fc"]} />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View pointerEvents="none" style={styles.wave}>
          {!t.dark && <HomeWaves fadeBottom />}
        </View>
        <View style={styles.brand}>
          <View style={styles.brandBadge}>
            <FillGradient colors={["#148dff", "#004ce5"]} />
            <Ionicons name="scan-outline" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wordmark, { color: t.text }]}>Folio</Text>
            <Text style={{ color: t.muted, fontSize: narrow ? 10 : 11 }}>
              Document Scanner & PDF Editor
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pro plan"
            onPress={() => router.push("/subscription")}
            style={styles.pro}
          >
            <MaterialCommunityIcons name="crown" size={17} color="#ffd527" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
              PRO
            </Text>
          </Pressable>
        </View>
        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={[styles.heroTitle, { color: t.text }]}>
              My Profile
            </Text>
            <Text style={{ color: t.muted, fontSize: 14, lineHeight: 19 }}>
              Manage your account, storage, backup and app preferences.
            </Text>
          </View>
          <View accessible={false} pointerEvents="none" style={styles.art}>
            <ScanArtwork workspace />
            <View style={styles.artId}>
              <Ionicons name="person-circle" size={26} color="#6e9ef6" />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.artLine} />
                <View style={[styles.artLine, { width: "73%" }]} />
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.card, styles.account, deviceCard]}>
          {!t.dark && (
            <View pointerEvents="none" style={styles.cardWave}>
              <HomeWaves fadeBottom />
            </View>
          )}
          <View style={[styles.avatar, { backgroundColor: t.tint }]}>
            <Ionicons name="person" size={43} color={t.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} style={[styles.name, { color: t.text }]}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>
              {user?.email ?? "Using locally on this device"}
            </Text>
            <View
              style={[
                styles.workspace,
                { backgroundColor: t.dark ? t.tint : "#ccf4da" },
              ]}
            >
              <Ionicons
                name={user ? "cloud-outline" : "phone-portrait-outline"}
                size={13}
                color={t.dark ? t.primary : "#087327"}
              />
              <Text
                style={{
                  color: t.dark ? t.primary : "#087327",
                  fontSize: 11,
                  fontWeight: "800",
                }}
              >
                {user ? "Folio Account" : "Local Workspace"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile details"
            onPress={() => {
              setNameDraft(localName);
              setPanel("profile");
            }}
            style={[styles.edit, { backgroundColor: t.tint }]}
          >
            <Ionicons name="pencil-outline" size={17} color={t.muted} />
          </Pressable>
        </View>
        <View style={[styles.card, deviceCard]}>
          <View style={styles.storage}>
            <View
              style={[
                styles.badge,
                { backgroundColor: t.dark ? t.tint : "#eae2fc" },
              ]}
            >
              <MaterialCommunityIcons
                name="database-outline"
                size={25}
                color={t.dark ? t.primary : "#6718dc"}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.storageTitle}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={[styles.rowTitle, { color: t.text }]}>
                    Device Storage
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 12 }}>
                    {storage
                      ? `${mb(storage.bytes)} MB${available === null ? "" : ` of ${mb(available)} MB`}`
                      : "Storage unavailable"}
                  </Text>
                </View>
                {available !== null && (
                  <Text
                    style={{
                      color: t.primary,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {Math.round(percent)}% Used
                  </Text>
                )}
              </View>
              {available !== null && (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Folio PDF storage usage"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.round(percent),
                  }}
                  style={[
                    styles.track,
                    { backgroundColor: t.dark ? t.line : "#d9e2f5" },
                  ]}
                >
                  <View
                    style={{
                      width: `${percent}%`,
                      height: "100%",
                      backgroundColor: t.primary,
                    }}
                  />
                </View>
              )}
            </View>
          </View>
          <View
            style={[
              styles.stats,
              { backgroundColor: t.dark ? t.bg : "#f5f8fd" },
            ]}
          >
            {(
              [
                [
                  "Documents",
                  storage?.count,
                  "document-text-outline",
                  "#e5f2ff",
                  "#006af0",
                ],
                [
                  "PDF Files",
                  storage?.pdfs,
                  "document-outline",
                  "#ffebeb",
                  "#f21533",
                ],
                [
                  "Folders",
                  scanFolders.length,
                  "folder-outline",
                  "#fff2d8",
                  "#dc9000",
                ],
              ] as const
            ).map(([label, count, icon, tint, color], index) => (
              <View
                key={label}
                style={[
                  styles.stat,
                  index > 0 && { borderLeftWidth: 1, borderColor: t.line },
                ]}
              >
                <View
                  style={[
                    styles.statBadge,
                    { backgroundColor: t.dark ? t.tint : tint },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={narrow ? 17 : 21}
                    color={t.dark ? t.primary : color}
                  />
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text
                    style={{ color: t.text, fontSize: 15, fontWeight: "900" }}
                  >
                    {count ?? "—"}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: narrow ? 9 : 11 }}>
                    {label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/documents")}
          style={styles.documents}
        >
          <FillGradient colors={["#0095f3", "#0049e8"]} />
          <Ionicons name="folder-outline" size={23} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
            Open My Documents
          </Text>
          <View style={styles.openArrow}>
            <Ionicons name="chevron-forward" size={18} color="#0055ed" />
          </View>
        </Pressable>
        <Text style={[styles.section, { color: t.text }]}>
          Account &amp; Sync
        </Text>
        <View style={[styles.card, deviceCard]}>
          {row(
            "Google Drive Backup",
            drive.account?.email ?? "Back up and restore your PDFs securely",
            "cloud-upload-outline",
            "#e2f5ec",
            "#00a760",
            () => setPanel("drive"),
            undefined,
            false,
            true,
          )}
        </View>
        {alerts &&
          !drive.busy &&
          /failed|need retry|could not/i.test(drive.status) && (
            <Label muted size={12}>
              {drive.status}
            </Label>
          )}
        <Text style={[styles.section, { color: t.text }]}>Security</Text>
        <View style={[styles.card, deviceCard]}>
          {row(
            "Biometric Lock",
            "Use fingerprint or face ID to lock the app",
            "finger-print-outline",
            "#e5f1ff",
            "#0065ec",
            undefined,
            <View style={layout.row}>
              {settings.lock && <Text style={styles.enabled}>Enabled</Text>}
              <Switch
                accessibilityLabel="Biometric Lock"
                value={settings.lock}
                thumbColor="#fff"
                trackColor={{ false: t.line, true: t.primary }}
                onValueChange={changeAppLock}
              />
            </View>,
            true,
          )}
          {row(
            "App Lock",
            "Manage authentication and device access",
            "lock-closed-outline",
            "#ede5ff",
            "#6915dc",
            () => setPanel("security"),
          )}
        </View>
        <View style={styles.settingsHeading}>
          <Text style={[styles.section, { color: t.text }]}>App Settings</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search settings"
            hitSlop={8}
            onPress={() => {
              setSettingsSearch("");
              setPanel("search");
            }}
          >
            <Ionicons name="search-outline" size={18} color={t.muted} />
          </Pressable>
        </View>
        <View style={[styles.card, deviceCard]}>
          {row(
            "Notifications",
            "Show backup alerts in Profile",
            "notifications-outline",
            "#e5f0ff",
            "#0065ec",
            undefined,
            <Switch
              accessibilityLabel="Show backup alerts in Profile"
              value={alerts}
              trackColor={{ false: t.line, true: t.primary }}
              onValueChange={async (value) => {
                try {
                  await setSetting("profileBackupAlerts", value);
                  setAlerts(value);
                } catch {
                  Alert.alert("Could not save preference", "Please try again.");
                }
              }}
            />,
            true,
          )}
          {preferenceRows.map(([key, description, icon, tint, color], index) =>
            row(
              panelTitle[key],
              description,
              icon,
              tint,
              color,
              () => setPanel(key),
              undefined,
              index < preferenceRows.length - 1,
            ),
          )}
        </View>
        <Text style={[styles.section, { color: t.text }]}>
          Support &amp; Feedback
        </Text>
        <View style={[styles.card, deviceCard]}>
          {row(
            "Help & Support",
            "Get help with Folio",
            "headset-outline",
            "#e5f1ff",
            "#0065ec",
            emailSupport,
            undefined,
            true,
          )}
          {row(
            "Share App",
            "Recommend Folio to friends and colleagues",
            "paper-plane-outline",
            "#e5f1ff",
            "#0065ec",
            shareFolio,
            undefined,
            true,
          )}
          {row(
            "Rate Us",
            "Share your experience on Google Play",
            "star-outline",
            "#fff2d8",
            "#dc9000",
            rateFolio,
            undefined,
            true,
          )}
          {row(
            "Check for Updates",
            "See the latest version on Google Play",
            "sync-outline",
            "#e5f1ff",
            "#0065ec",
            rateFolio,
          )}
        </View>
        <Text style={[styles.section, { color: t.text }]}>About</Text>
        <View style={[styles.card, deviceCard]}>
          {row(
            "About Folio",
            "App version and developer information",
            "information-circle-outline",
            "#e5f1ff",
            "#0065ec",
            () => setPanel("about"),
            <View style={layout.row}>
              {version && (
                <Text
                  style={[
                    styles.versionBadge,
                    { color: t.primary, backgroundColor: t.tint },
                  ]}
                >
                  v{version}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={19} color={t.muted} />
            </View>,
            true,
          )}
          {row(
            "Privacy & Security",
            "How Folio handles and protects your data",
            "shield-checkmark-outline",
            "#e5f1ff",
            "#0065ec",
            () => setPanel("privacy"),
            undefined,
            true,
          )}
          {row(
            "Privacy Policy",
            "Read our privacy policy",
            "document-text-outline",
            "#e5f1ff",
            "#0065ec",
            () => setPanel("fullPrivacy"),
            undefined,
            true,
          )}
          {row(
            "Terms of Service",
            "Read the Folio Software License Agreement",
            "reader-outline",
            "#e5f1ff",
            "#0065ec",
            () => setPanel("license"),
          )}
        </View>
      </ScrollView>
      <Modal
        visible={panel !== null}
        animationType="slide"
        onRequestClose={() =>
          setPanel(
            panel === "license" || panel === "appInfo"
              ? "about"
              : panel === "fullPrivacy"
                ? "privacy"
                : null,
          )
        }
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
          {(panel === "appearance" ||
            panel === "about" ||
            panel === "license") &&
            !t.dark && (
              <>
                <FillGradient colors={["#e3edff", "#f0f4fc"]} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 185,
                    opacity: 0.55,
                  }}
                >
                  <HomeWaves />
                </View>
              </>
            )}
          <ScrollView
            key={panel}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={layout.content}
          >
            {panel !== "appearance" && (
              <View style={layout.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    panel === "license" || panel === "appInfo"
                      ? "Back to About Folio"
                      : panel === "fullPrivacy"
                        ? "Back to Privacy & Security"
                        : "Back to Profile"
                  }
                  onPress={() =>
                    setPanel(
                      panel === "license" || panel === "appInfo"
                        ? "about"
                        : panel === "fullPrivacy"
                          ? "privacy"
                          : null,
                    )
                  }
                  style={styles.edit}
                >
                  <Ionicons name="arrow-back" size={22} color={t.primary} />
                </Pressable>
                <Label size={21}>{panel && panelTitle[panel]}</Label>
              </View>
            )}
            {panel === "profile" && (
              <Card>
                {!user && (
                  <>
                    <Field
                      value={nameDraft}
                      onChangeText={(value) => setNameDraft(value.slice(0, 50))}
                      placeholder="Display name"
                    />
                    <Button
                      title="Save display name"
                      disabled={!nameDraft.trim()}
                      onPress={async () => {
                        const value = nameDraft.trim();
                        await setSetting("localProfileName", value);
                        setLocalName(value);
                        setPanel(null);
                      }}
                    />
                  </>
                )}
                {user && <Label>{user.email}</Label>}
                {folioServerEnabled &&
                  (!user ? (
                    <Button
                      title="Sign in or create account"
                      onPress={() => {
                        setPanel(null);
                        router.push("/login");
                      }}
                    />
                  ) : (
                    <Button
                      title="Sign out"
                      icon="log-out-outline"
                      secondary
                      onPress={signOut}
                    />
                  ))}
              </Card>
            )}
            {panel === "security" && (
              <Card>
                <Label muted>
                  App Lock requires device authentication to open Folio.
                </Label>
                <Button
                  secondary
                  icon="finger-print-outline"
                  title={settings.lock ? "Disable App Lock" : "Enable App Lock"}
                  onPress={() => changeAppLock(!settings.lock)}
                />
                <Button
                  title="Device app settings"
                  icon="settings-outline"
                  secondary
                  onPress={() => Linking.openSettings()}
                />
              </Card>
            )}
            {panel === "licenses" && (
              <Card>
                <Label muted>
                  Declared licenses for Folio’s direct mobile libraries.
                </Label>
                {mobileLicenses.map(({ name, version, license }) => (
                  <View
                    key={name}
                    style={[styles.licenseRow, { borderColor: t.line }]}
                  >
                    <Label size={14}>{name}</Label>
                    <Label muted size={12}>
                      {version} · {license}
                    </Label>
                  </View>
                ))}
              </Card>
            )}
            {panel === "drive" && (
              <>
                <DriveBackupPanel />
                <Disclosure
                  title="Back up or move to a new phone"
                  icon="phone-portrait-outline"
                  description="Export and import PDFs without signing in"
                >
                  <Label muted size={13}>
                    Export regular PDFs to a folder, then copy the folder to
                    your new phone or upload it to your own Drive. Private ID
                    scans and Trash are excluded. Imports create new copies.
                  </Label>
                  <Button
                    title="Export PDFs to folder"
                    icon="download-outline"
                    disabled={!!transfer}
                    onPress={async () => {
                      setTransfer("Choose a backup folder…");
                      try {
                        const result = await exportLibraryPdfs(setTransfer);
                        if (result)
                          Alert.alert(
                            "PDF export complete",
                            `${result.exported} saved.${result.failed.length ? ` Could not export: ${result.failed.slice(0, 5).join(", ")} (${result.failed.length} failed).` : ""}`,
                          );
                      } finally {
                        setTransfer("");
                      }
                    }}
                  />
                  <Button
                    title="Import backup PDFs"
                    icon="cloud-download-outline"
                    secondary
                    disabled={!!transfer}
                    onPress={async () => {
                      setTransfer("Choose backup PDFs…");
                      try {
                        const result = await restoreLibraryPdfs(setTransfer);
                        if (result)
                          Alert.alert(
                            "PDF import complete",
                            `${result.restored} added to Documents. ${result.failed.length} failed.`,
                          );
                      } finally {
                        setTransfer("");
                      }
                    }}
                  />
                  {!!transfer && <Label muted>{transfer}</Label>}
                </Disclosure>
                {folioServerEnabled && (
                  <Disclosure title="Cloud backup" icon="cloud-upload-outline">
                    <Label muted>
                      When enabled, Folio automatically uploads ordinary
                      documents to your account while the app is open. ID scans
                      stay local. Disable backup at any time.
                    </Label>
                    <View
                      style={{ ...layout.row, justifyContent: "space-between" }}
                    >
                      <Label>Allow cloud backup</Label>
                      <Switch
                        accessibilityLabel="Allow cloud backup"
                        trackColor={{ false: t.line, true: t.primary }}
                        value={settings.backup}
                        onValueChange={(v) => {
                          if (v && !user) {
                            setPanel(null);
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
                    <Button
                      title="Check for missing cloud PDFs"
                      secondary
                      icon="cloud-download-outline"
                      disabled={!settings.backup || !user}
                      onPress={() => sync(setProgress, true)}
                    />
                    <Label muted>{progress || autoSyncStatus}</Label>
                  </Disclosure>
                )}
              </>
            )}
            {panel === "appearance" && (
              <AppearanceSettings onBack={() => setPanel(null)} />
            )}
            {panel === "scan" && (
              <>
                <Card>
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
                </Card>
                <Disclosure
                  title="Default scan folder"
                  icon="folder-open-outline"
                  description={
                    scanFolders.find((item) => item.id === defaultFolder)
                      ?.name ?? folioScanFolderName
                  }
                  initiallyOpen
                >
                  <Label muted>
                    New scans and photo PDFs are saved here automatically.
                    Create folders in Documents.
                  </Label>
                  <View style={layout.wrap}>
                    {scanFolders.map((item) => (
                      <Chip
                        key={item.id}
                        title={item.name}
                        selected={defaultFolder === item.id}
                        onPress={async () => {
                          try {
                            await setSetting("defaultScanFolder", item.id);
                            setDefaultFolder(item.id);
                          } catch {
                            Alert.alert(
                              "Could not save preference",
                              "Please try again.",
                            );
                          }
                        }}
                      />
                    ))}
                  </View>
                </Disclosure>
              </>
            )}
            {panel === "fullPrivacy" && <PrivacyPolicy full />}
            {panel === "privacy" && (
              <>
                <Label muted>
                  How we handle, protect and keep your data safe.
                </Label>
                <PrivacyPolicy onReadFull={() => setPanel("fullPrivacy")} />
                {folioServerEnabled && user && (
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
                        await FS.writeAsStringAsync(
                          uri,
                          JSON.stringify(data, null, 2),
                        );
                        await Sharing.shareAsync(uri, {
                          mimeType: "application/json",
                        });
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
                                  api.request("/auth/account", {
                                    method: "DELETE",
                                  }),
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
              </>
            )}
            {panel === "license" && (
              <SoftwareLicense
                onLicenses={() => setPanel("licenses")}
                onPrivacy={() => setPanel("privacy")}
                onWebsite={() =>
                  void openExternal(
                    companyWebsite,
                    "Please try opening the NextZen IT Solution website again.",
                  )
                }
              />
            )}
            {panel === "appInfo" && (
              <>
                <Card>
                  <Label size={19}>
                    Folio – Document Scanner &amp; PDF Editor
                  </Label>
                  {version && <Label muted>Version {version}</Label>}
                  <Button
                    title="Privacy Policy"
                    icon="shield-checkmark-outline"
                    secondary
                    onPress={() => setPanel("fullPrivacy")}
                  />
                  <Button
                    title="Software License Agreement"
                    icon="reader-outline"
                    secondary
                    onPress={() => setPanel("license")}
                  />
                  <Button
                    title="Open Source Licenses"
                    icon="code-slash-outline"
                    secondary
                    onPress={() => setPanel("licenses")}
                  />
                  <Button
                    title="Send Feedback"
                    icon="chatbubble-outline"
                    secondary
                    onPress={() =>
                      void openExternal(
                        "mailto:info@nextzenitsolution.in?subject=Folio%20feedback",
                        "You can email info@nextzenitsolution.in with feedback.",
                      )
                    }
                  />
                </Card>
                <Card>
                  <Label size={17}>About NextZen IT Solution</Label>
                  <Label muted>
                    NextZen IT Solution develops mobile applications, software
                    solutions, and digital experiences. Folio reflects our
                    commitment to thoughtful design, practical functionality,
                    and continuous improvement.
                  </Label>
                </Card>
              </>
            )}
            {panel === "about" && (
              <>
                <AboutFolio
                  version={version}
                  website={companyWebsite}
                  onScan={() => {
                    setPanel(null);
                    void launchScanner();
                  }}
                  onTools={() => {
                    setPanel(null);
                    router.push("/tools");
                  }}
                  onDocuments={() => {
                    setPanel(null);
                    router.push("/documents");
                  }}
                  onPrivacy={() => setPanel("privacy")}
                  onBackup={() => setPanel("drive")}
                  onWebsite={() =>
                    void openExternal(
                      companyWebsite,
                      "Please try opening the NextZen IT Solution website again.",
                    )
                  }
                  onRate={rateFolio}
                  onSupport={emailSupport}
                  onShare={shareFolio}
                  onAppInfo={() => setPanel("appInfo")}
                />
                {folioServerEnabled && (
                  <Disclosure title="Plan & purchases" icon="sparkles-outline">
                    <Button
                      title="Plans & restore purchases"
                      icon="sparkles-outline"
                      secondary
                      onPress={() => {
                        setPanel(null);
                        router.push("/subscription");
                      }}
                    />
                    <Label muted>
                      Local scanning and basic PDF tools are free. View plans to
                      check purchase availability for this build.
                    </Label>
                    {user && (
                      <Button
                        title="Check verified entitlement"
                        secondary
                        onPress={async () => {
                          const result = await authorized(() =>
                            api.request<{
                              subscription: {
                                plan: string;
                                expiryDate: string;
                              } | null;
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
                )}
              </>
            )}
            {panel === "search" && (
              <>
                <Field
                  value={settingsSearch}
                  onChangeText={setSettingsSearch}
                  placeholder="Search settings"
                />
                {(
                  [
                    [
                      "profile",
                      "profile account name sign in biometric app lock device settings permissions",
                    ],
                    [
                      "drive",
                      "cloud backup restore sync google drive gmail import export transfer new phone",
                    ],
                    ["appearance", "appearance dark light theme"],
                    ["scan", "scan quality default scan folder"],
                    ["privacy", "privacy security storage data"],
                    ["about", "about version plan subscription purchases"],
                  ] as const
                )
                  .filter(([, keywords]) =>
                    keywords.includes(settingsSearch.trim().toLowerCase()),
                  )
                  .map(([key]) => (
                    <Button
                      key={key}
                      secondary
                      title={panelTitle[key]}
                      onPress={() => {
                        if (key === "profile") setNameDraft(localName);
                        setPanel(key);
                      }}
                    />
                  ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  enabled: {
    color: "#087327",
    backgroundColor: "#ccf4da",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: "800",
    fontSize: 10,
  },
  versionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: "800",
    fontSize: 11,
  },
  licenseRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 3,
  },
  content: { padding: 14, paddingTop: 12, paddingBottom: 23, gap: 11 },
  wave: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 2,
    height: 206,
    opacity: 0.72,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 4,
  },
  brandBadge: {
    width: 35,
    height: 36,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 30,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  pro: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#005bed",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 100,
    paddingLeft: 8,
  },
  heroTitle: { fontSize: 29, fontWeight: "900", letterSpacing: -1 },
  art: { width: "36%", height: 105 },
  artId: {
    position: "absolute",
    top: 12,
    left: 1,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    padding: 5,
    borderRadius: 8,
    backgroundColor: "#f7fbff",
    transform: [{ rotate: "12deg" }],
    elevation: 3,
  },
  artLine: { height: 3, borderRadius: 2, backgroundColor: "#b0c8f7" },
  card: {
    borderWidth: 1,
    borderRadius: 17,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#496ca8",
    shadowOpacity: 0.13,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  account: {
    minHeight: 87,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardWave: {
    position: "absolute",
    bottom: 0,
    right: 0,
    left: 0,
    height: 86,
  },
  avatar: {
    width: 63,
    height: 63,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontSize: 22, letterSpacing: -0.6, fontWeight: "900" },
  workspace: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  edit: {
    width: 33,
    height: 33,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  storage: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 11,
  },
  storageTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  track: { height: 9, borderRadius: 5, overflow: "hidden" },
  stats: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 3,
  },
  statBadge: {
    width: 29,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  documents: {
    minHeight: 45,
    backgroundColor: "#0049e8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 3,
    paddingHorizontal: 34,
  },
  openArrow: {
    position: "absolute",
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  section: { fontSize: 17, fontWeight: "900", paddingLeft: 8 },
  settingsHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  rowCopy: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  badge: {
    width: 40,
    height: 37,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
});
