import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Field, Card, layout } from "../../components/ui";
import { Notice } from "../../components/experience";
import { DocumentList } from "../../components/DocumentList";
import {
  FillGradient,
  HomeWaves,
  ScanArtwork,
} from "../../components/HomeArtwork";
import { createFolder, folders } from "../../database";
import { useLibrary } from "../../hooks/useLibrary";
import { useTheme } from "../../theme";
import { launchScanner } from "../../features/scanner/launch";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import { importImages } from "../../features/scanner";
import { importPdf } from "../../features/documents/import";
import { useDraft } from "../../store";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
const shadow = {
  elevation: 3,
  shadowColor: "#375eaf",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
};

export default function Documents() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites" | "trash">("all");
  const [grid, setGrid] = useState(false);
  const [sort, setSort] = useState<"date" | "name" | "size">("date");
  const [folder, setFolder] = useState<string | null>(null);
  const [allFolders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [newFolder, setNewFolder] = useState("");
  const [showFolder, setShowFolder] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [imagesOnly, setImagesOnly] = useState(false);
  const pending = useRef(false);
  const active = useLibrary();
  const trash = useLibrary("", true);
  const results = useLibrary(query, filter === "trash", sort);
  const library =
    query.trim() || sort !== "date"
      ? results
      : filter === "trash"
        ? trash
        : active;
  const { documents, loading, error } = library;

  function reload() {
    void active.reload();
    void trash.reload();
    if (library === results) void results.reload();
  }

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    try {
      await action();
    } catch (e) {
      Alert.alert(
        "Unable to complete",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      pending.current = false;
    }
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void folders()
        .then((items) => {
          if (alive) setFolders(items);
        })
        .catch((e) => {
          if (alive) Alert.alert("Couldn't load folders", String(e));
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const visible = documents.filter(
    (d) =>
      (filter !== "favorites" || d.favorite) &&
      (!folder || d.folderId === folder) &&
      (!imagesOnly || d.pages.length > 0),
  );
  const images = active.documents.reduce(
    (count, d) => count + d.pages.length,
    0,
  );
  const recent =
    !showAll &&
    !grid &&
    !query.trim() &&
    filter === "all" &&
    !folder &&
    !imagesOnly &&
    sort === "date";
  const matchingFolders = allFolders.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function pill(
    label: string,
    icon: Icon,
    onPress: () => void,
    selected = false,
    soft = false,
  ) {
    const color = selected && !soft ? "#ffffff" : selected ? t.primary : t.text;
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.pill,
          {
            paddingHorizontal: narrow ? 10 : 13,
            backgroundColor: selected ? (soft ? t.tint : "#0969f3") : t.surface,
            borderColor: selected && !soft ? "#0969f3" : t.line,
          },
        ]}
      >
        <Ionicons name={icon} size={17} color={color} />
        <Text style={{ color, fontWeight: "700", fontSize: narrow ? 11 : 12 }}>
          {label}
        </Text>
      </Pressable>
    );
  }

  function heading(title: string, icon: Icon, action?: () => void) {
    return (
      <View style={styles.heading}>
        <Ionicons name={icon} color={t.primary} size={21} />
        <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See all ${title.toLowerCase()}`}
            onPress={action}
            style={styles.link}
          >
            <Text style={{ color: t.primary, fontWeight: "700", fontSize: 12 }}>
              See All
            </Text>
            <Ionicons name="chevron-forward" color={t.primary} size={15} />
          </Pressable>
        )}
      </View>
    );
  }

  const actions = [
    [
      "Scan\nDocument",
      "scan-outline",
      "#0657e8",
      "#deebff",
      () => run(launchScanner),
    ],
    [
      "Photo to\nPDF",
      "image-outline",
      "#9918de",
      "#f1e4ff",
      () =>
        run(async () => {
          if (!(await confirmReplaceDraft())) return;
          const pages = await importImages();
          if (!pages.length) return;
          useDraft.getState().clear();
          useDraft.getState().add(pages);
          router.push("/editor");
        }),
    ],
    [
      "Import\nPDF",
      "download-outline",
      "#05a744",
      "#e1f8eb",
      () =>
        run(async () => {
          const doc = await importPdf();
          if (doc)
            router.push({ pathname: "/document/[id]", params: { id: doc.id } });
        }),
    ],
    [
      "Edit\nPDF",
      "pencil-outline",
      "#ed7803",
      "#fff0e1",
      () =>
        router.push({
          pathname: "/tools",
          params: { tool: "Sign / annotate PDF" },
        }),
    ],
    [
      "Merge\nPDF",
      "copy-outline",
      "#7424ee",
      "#eae4ff",
      () => router.push("/merge"),
    ],
  ] as const;
  const stats = [
    [
      "PDFs",
      active.documents.length,
      "document-text-outline",
      "#f32148",
      "#ffe2e6",
      "#fff6f7",
      () => {
        setFilter("all");
        setImagesOnly(false);
        setFolder(null);
        setShowAll(true);
      },
    ],
    [
      "Images",
      images,
      "image-outline",
      "#0657e8",
      "#dceaff",
      "#f5faff",
      () => {
        setFilter("all");
        setImagesOnly(!imagesOnly);
        setFolder(null);
        setShowAll(true);
      },
    ],
    [
      "Folders",
      allFolders.length,
      "folder-open-outline",
      "#05aa51",
      "#dcf8e7",
      "#f5fcf8",
      () => setShowFolders(!showFolders),
    ],
  ] as const;

  const header = (
    <View style={styles.header}>
      <View style={styles.heroWaves}>{!t.dark && <HomeWaves />}</View>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          <FillGradient colors={["#6db1ff", "#0045d9"]} />
          <Ionicons name="scan-outline" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.wordmark, { color: t.text }]}>
            folio<Text style={{ color: t.primary }}>.</Text>
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: t.muted,
              fontSize: narrow ? 9 : 11,
              fontWeight: "600",
            }}
          >
            Document Scanner & PDF Editor
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Backup settings"
          onPress={() => router.push("/profile")}
          hitSlop={8}
        >
          <Ionicons name="notifications-outline" size={23} color={t.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pro plan"
          onPress={() => router.push("/subscription")}
          style={styles.pro}
        >
          <MaterialCommunityIcons name="crown" size={18} color="#ffca40" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
            PRO
          </Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text
            style={{
              color: t.primary,
              letterSpacing: 2.2,
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            YOUR LIBRARY
          </Text>
          <Text
            style={{
              color: t.text,
              fontSize: narrow ? 30 : 35,
              fontWeight: "900",
              letterSpacing: -1.35,
            }}
          >
            Documents
          </Text>
          <Text
            style={{
              color: t.muted,
              fontSize: 14,
              lineHeight: 19,
              fontWeight: "600",
              marginTop: 4,
            }}
          >
            Scan, edit, organize and manage your documents in one place.
          </Text>
        </View>
        <View accessible={false} pointerEvents="none" style={styles.art}>
          <ScanArtwork phone />
        </View>
      </View>
      <View
        style={[
          styles.search,
          shadow,
          { backgroundColor: t.surface, borderColor: t.line },
        ]}
      >
        <Ionicons name="search-outline" size={22} color={t.muted} />
        <TextInput
          accessibilityLabel="Search documents and folders"
          placeholder="Search documents, folders..."
          placeholderTextColor={t.muted}
          value={query}
          onChangeText={setQuery}
          style={{
            flex: 1,
            color: t.text,
            fontSize: 14,
            fontWeight: "600",
            paddingVertical: 8,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort and display options"
          accessibilityState={{ expanded: showOptions }}
          onPress={() => setShowOptions(!showOptions)}
          style={[styles.options, { backgroundColor: t.tint }]}
        >
          <Ionicons name="options-outline" color={t.text} size={21} />
        </Pressable>
      </View>
      {showOptions && (
        <View style={styles.wrap}>
          {pill(
            { date: "Recent first", name: "A–Z", size: "Largest first" }[sort],
            "swap-vertical",
            () =>
              setSort(
                sort === "date" ? "name" : sort === "name" ? "size" : "date",
              ),
          )}
          {pill(
            grid ? "List view" : "Grid view",
            grid ? "list" : "grid-outline",
            () => setGrid(!grid),
          )}
        </View>
      )}
      <View style={styles.wrap}>
        {pill(
          `All Files (${active.documents.length})`,
          "document-outline",
          () => {
            setFilter("all");
            setImagesOnly(false);
          },
          filter === "all",
        )}
        {pill(
          `Favorites (${active.documents.filter((d) => d.favorite).length})`,
          "star-outline",
          () => {
            setFilter("favorites");
            setImagesOnly(false);
          },
          filter === "favorites",
        )}
        {pill(
          `Trash (${trash.documents.length})`,
          "trash-outline",
          () => {
            setFilter("trash");
            setImagesOnly(false);
          },
          filter === "trash",
        )}
      </View>
      <View style={styles.wrap}>
        {pill(
          `All Folders (${allFolders.length})`,
          "folder-open-outline",
          () => {
            if (folder) setFolder(null);
            setShowFolders(folder ? true : !showFolders);
          },
          !folder,
          true,
        )}
        {pill(
          "New Folder",
          "add",
          () => setShowFolder(!showFolder),
          showFolder,
          true,
        )}
      </View>
      {(showFolders ||
        folder ||
        (query.trim() && matchingFolders.length > 0)) && (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {matchingFolders.map((f) =>
            pill(
              f.name,
              "folder-outline",
              () => {
                setFolder(folder === f.id ? null : f.id);
                if (query.trim()) setQuery("");
              },
              folder === f.id,
              true,
            ),
          )}
          {!matchingFolders.length && (
            <Text style={{ color: t.muted }}>No folders to show</Text>
          )}
        </ScrollView>
      )}
      {showFolder && (
        <Card>
          <Field
            value={newFolder}
            onChangeText={setNewFolder}
            placeholder="Folder name"
          />
          <View style={layout.row}>
            <Button
              title="Create folder"
              disabled={!newFolder.trim()}
              onPress={() =>
                run(async () => {
                  await createFolder(newFolder.trim());
                  setFolders(await folders());
                  setNewFolder("");
                  setShowFolder(false);
                  setShowFolders(true);
                })
              }
            />
            <Button
              title="Cancel"
              secondary
              onPress={() => setShowFolder(false)}
            />
          </View>
        </Card>
      )}
      <View style={styles.tiles}>
        {stats.map(([label, count, icon, color, tint, background, onPress]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`${count} ${label === "Images" ? "scan page images" : label}`}
            onPress={onPress}
            style={[
              styles.stat,
              shadow,
              {
                backgroundColor: t.dark ? t.surface : background,
                borderColor: t.line,
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: t.dark ? t.tint : tint,
                  width: narrow ? 27 : 35,
                  height: narrow ? 30 : 37,
                },
              ]}
            >
              <Ionicons
                name={icon}
                size={narrow ? 18 : 22}
                color={t.dark ? t.primary : color}
              />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700" }}>
                {label}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={{ color: t.text, fontWeight: "900", fontSize: 21 }}
              >
                {count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 8, marginTop: 3 }}>
        {heading("Quick Actions", "flash", () => router.push("/tools"))}
        <View style={styles.tiles}>
          {actions.map(([label, icon, color, tint, onPress]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label.replace("\n", " ")}
              onPress={onPress}
              style={[
                styles.action,
                shadow,
                { backgroundColor: t.surface, borderColor: t.line },
              ]}
            >
              <View
                style={[
                  styles.badge,
                  { backgroundColor: t.dark ? t.tint : tint },
                ]}
              >
                <Ionicons
                  name={icon}
                  size={23}
                  color={t.dark ? t.primary : color}
                />
              </View>
              <Text
                style={{
                  textAlign: "center",
                  color: t.text,
                  fontWeight: "800",
                  fontSize: narrow ? 10 : 11,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {error ? (
        <>
          <Notice error message={error} />
          <Button title="Try again" onPress={reload} />
        </>
      ) : loading && !documents.length ? (
        <ActivityIndicator style={{ padding: 16 }} color={t.primary} />
      ) : (
        <View
          style={[
            styles.listTitle,
            {
              backgroundColor: t.surface,
              borderColor: t.line,
              borderBottomLeftRadius: visible.length && !grid ? 0 : 18,
              borderBottomRightRadius: visible.length && !grid ? 0 : 18,
            },
          ]}
        >
          {heading(
            recent
              ? "Recent Documents"
              : imagesOnly
                ? "Documents with Images"
                : filter === "favorites"
                  ? "Favorites"
                  : filter === "trash"
                    ? "Trash"
                    : "Documents",
            "time-outline",
            recent ? () => setShowAll(true) : undefined,
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {!t.dark && <FillGradient colors={["#e9f0ff", "#f6f8fc"]} />}
      <DocumentList
        header={header}
        inset={14}
        compact={!grid}
        grouped={!grid}
        documents={error ? [] : recent ? visible.slice(0, 3) : visible}
        grid={grid}
        showEmpty={!error && (!loading || documents.length > 0)}
        onChange={reload}
        refreshing={loading && documents.length > 0}
        onRefresh={reload}
        emptyTitle={
          query
            ? "No matches yet"
            : filter === "trash"
              ? "Your trash is empty"
              : filter === "favorites"
                ? "No favorites yet"
                : folder
                  ? "This folder is empty"
                  : imagesOnly
                    ? "No scan images yet"
                    : "Your first scan starts here"
        }
        emptyMessage={
          query
            ? "Try another document name or a word from recognized text."
            : filter === "trash"
              ? "Deleted files appear here. Open a file to restore it."
              : filter === "favorites"
                ? "Favorite a document to find it here."
                : folder
                  ? "Open a document to move it into this folder."
                  : imagesOnly
                    ? "Scanned pages will appear here after you save a scan."
                    : undefined
        }
        showScanAction={!query && filter === "all" && !folder}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, paddingTop: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandIcon: {
    width: 39,
    height: 40,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontWeight: "900",
    letterSpacing: -1.8,
    fontSize: 33,
    lineHeight: 35,
  },
  pro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 20,
    backgroundColor: "#005bea",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 143,
    paddingLeft: 8,
  },
  heroText: { flex: 1, gap: 3, zIndex: 1 },
  art: { width: "44%", height: 153, marginLeft: -3 },
  heroWaves: {
    position: "absolute",
    left: -14,
    right: -14,
    top: 28,
    height: 230,
    opacity: 0.65,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  options: { padding: 7, borderRadius: 20, marginRight: -6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 37,
    borderRadius: 22,
    borderWidth: 1,
  },
  tiles: { flexDirection: "row", gap: 7 },
  stat: {
    flex: 1,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    padding: 7,
    gap: 7,
    borderRadius: 15,
    borderWidth: 1,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: "900" },
  link: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  action: {
    flex: 1,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 15,
    borderWidth: 1,
  },
  listTitle: {
    marginTop: 3,
    padding: 9,
    borderWidth: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
});
