import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import {
  connectDrive,
  disconnectDrive,
  setAutomaticDriveBackup,
  syncDrive,
  useDriveBackup,
} from "../features/drive";
import { useTheme } from "../theme";
import { Button, Card, Label } from "./ui";
import { Disclosure } from "./experience";

export function DriveBackupPanel() {
  const t = useTheme();
  const drive = useDriveBackup();
  const [query, setQuery] = useState("");
  const [sortByName, setSortByName] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [changingAutomatic, setChangingAutomatic] = useState(false);
  if (Platform.OS !== "android") {
    return (
      <Label muted>
        Google Drive linking is available on Android. You can export and import
        PDFs below.
      </Label>
    );
  }

  const matching = drive.files
    .filter((file) =>
      file.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sortByName
        ? a.name.localeCompare(b.name)
        : (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""),
    );
  const files = expanded ? matching : matching.slice(0, 6);

  function openDrive(url: string) {
    void Linking.openURL(url).catch(() =>
      Alert.alert(
        "Couldn't open Google Drive",
        "Try opening Google Drive again.",
      ),
    );
  }
  function disconnect() {
    Alert.alert(
      "Disconnect Google Drive?",
      "Your backup copies will stay in Drive.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          onPress: () =>
            void disconnectDrive().catch((error) =>
              Alert.alert("Couldn't disconnect", String(error)),
            ),
        },
      ],
    );
  }

  return (
    <>
      <Card>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: t.tint }]}>
            <Svg width={29} height={29} viewBox="0 0 32 32">
              <Path fill="#00a760" d="M10 3h9L7 25l-5-8Z" />
              <Path fill="#ffbc00" d="M10 3h9l12 20h-9Z" />
              <Path fill="#2684fc" d="M7 25l5-8h16l4 0-5 9H7Z" />
            </Svg>
            {drive.account && (
              <Ionicons
                name="checkmark-circle"
                size={17}
                color="#06ad4b"
                style={styles.connected}
              />
            )}
          </View>
          <View style={styles.copy}>
            <Label size={15}>
              {drive.account
                ? "Connected to Google Drive"
                : "Connect Google Drive"}
            </Label>
            <Label muted size={12}>
              {drive.lastBackup
                ? `Last backup: ${new Date(drive.lastBackup).toLocaleString()}`
                : (drive.account?.email ?? "Back up and restore your PDFs")}
            </Label>
          </View>
          {drive.account && (
            <Pressable
              accessibilityRole="button"
              disabled={drive.busy}
              onPress={disconnect}
              style={[
                styles.outline,
                { borderColor: t.primary, opacity: drive.busy ? 0.5 : 1 },
              ]}
            >
              <Text
                style={{ color: t.primary, fontWeight: "700", fontSize: 12 }}
              >
                Disconnect
              </Text>
            </Pressable>
          )}
        </View>
        {!drive.account && (
          <Button
            title="Connect Google Drive"
            icon="logo-google"
            disabled={drive.busy}
            onPress={connectDrive}
          />
        )}
      </Card>

      {drive.account && (
        <>
          <Card>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: t.tint }]}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={24}
                  color={t.primary}
                />
              </View>
              <View style={styles.copy}>
                <Label size={15}>Auto Backup</Label>
                <Label muted size={12}>
                  Back up PDFs while Folio is open
                </Label>
              </View>
              <Switch
                accessibilityLabel="Auto Backup"
                value={drive.automatic}
                disabled={changingAutomatic || drive.busy}
                trackColor={{ false: t.line, true: t.primary }}
                thumbColor="#ffffff"
                onValueChange={async (value) => {
                  setChangingAutomatic(true);
                  try {
                    await setAutomaticDriveBackup(value);
                  } catch {
                    Alert.alert(
                      "Couldn't save preference",
                      "Please try again.",
                    );
                  } finally {
                    setChangingAutomatic(false);
                  }
                }}
              />
            </View>
          </Card>
          <Card>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Label size={18}>Backed Up PDFs ({drive.files.length})</Label>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh backup list"
                disabled={drive.busy}
                onPress={() => void syncDrive(true)}
                style={styles.touch}
              >
                <Ionicons
                  name="sync-outline"
                  size={23}
                  color={drive.busy ? t.muted : t.primary}
                />
              </Pressable>
            </View>
            <View style={styles.row}>
              <View
                style={[
                  styles.search,
                  { borderColor: t.line, backgroundColor: t.bg },
                ]}
              >
                <Ionicons name="search-outline" size={19} color={t.muted} />
                <TextInput
                  accessibilityLabel="Search backed up PDFs"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search in backup..."
                  placeholderTextColor={t.muted}
                  style={[styles.input, { color: t.text }]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  sortByName
                    ? "Sorted by name. Sort by latest"
                    : "Sorted by latest. Sort by name"
                }
                onPress={() => setSortByName(!sortByName)}
                style={[styles.outline, styles.touch, { borderColor: t.line }]}
              >
                <Ionicons
                  name="options-outline"
                  size={21}
                  color={sortByName ? t.primary : t.muted}
                />
              </Pressable>
            </View>
            {!!drive.status && (
              <Label muted size={12}>
                {drive.status}
              </Label>
            )}
            <View>
              {files.map((file) => {
                const size =
                  file.size >= 1048576
                    ? `${(file.size / 1048576).toFixed(1)} MB`
                    : file.size
                      ? `${Math.ceil(file.size / 1024)} KB`
                      : "";
                const metadata = [
                  size,
                  file.modifiedTime
                    ? new Date(file.modifiedTime).toLocaleDateString()
                    : "",
                  file.hidden ? "App backup" : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <View
                    key={file.id}
                    style={[styles.row, styles.file, { borderColor: t.line }]}
                  >
                    <View
                      style={[
                        styles.icon,
                        { backgroundColor: t.dark ? t.tint : "#fbe6ec" },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={23}
                        color={t.dark ? t.primary : "#d52643"}
                      />
                    </View>
                    <View style={styles.copy}>
                      <Label size={14} numberOfLines={1}>
                        {file.name}
                      </Label>
                      {!!metadata && (
                        <Label muted size={12}>
                          {metadata}
                        </Label>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Options for ${file.name}`}
                      style={styles.touch}
                      onPress={() =>
                        file.hidden
                          ? Alert.alert(
                              file.name,
                              "This older backup is stored in Folio’s hidden Drive app data. Use Back Up & Restore Now to restore it if it is missing locally.",
                            )
                          : Alert.alert(file.name, undefined, [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Open in Google Drive",
                                onPress: () =>
                                  openDrive(
                                    `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
                                  ),
                              },
                            ])
                      }
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={19}
                        color={t.muted}
                      />
                    </Pressable>
                  </View>
                );
              })}
              {!files.length && (
                <Label muted>
                  {query.trim()
                    ? "No matching backups."
                    : drive.busy
                      ? "Checking Google Drive…"
                      : "No PDFs backed up yet."}
                </Label>
              )}
            </View>
            {matching.length > 6 && (
              <Button
                title={
                  expanded
                    ? "Show fewer files"
                    : `View all ${matching.length} files`
                }
                icon={expanded ? "chevron-up" : "chevron-down"}
                secondary
                onPress={() => setExpanded(!expanded)}
              />
            )}
            <Button
              title="Back Up & Restore Now"
              icon="cloud-upload-outline"
              disabled={drive.busy}
              onPress={() => syncDrive()}
            />
            {drive.folderId && (
              <Button
                title="Open backup folder in Drive"
                icon="folder-open-outline"
                secondary
                onPress={() =>
                  openDrive(
                    `https://drive.google.com/drive/folders/${encodeURIComponent(drive.folderId!)}`,
                  )
                }
              />
            )}
          </Card>
        </>
      )}
      <Disclosure title="How backup works" icon="information-circle-outline">
        <Label muted size={13}>
          Folio backs up eligible PDFs to Folio/Documents in Google Drive.
          Connect the same account on your new phone to restore them. Private ID
          scans, files in Folio Trash, and PDFs over 30 MB are excluded from new
          backups. Moving a PDF to Folio Trash keeps its existing Drive copy.
        </Label>
      </Disclosure>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, gap: 4 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  connected: { position: "absolute", bottom: -2, right: -2 },
  outline: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  touch: {
    minHeight: 40,
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, minHeight: 40 },
  file: { paddingVertical: 8, borderBottomWidth: 1 },
});
