import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { folioServerEnabled } from "../features/auth/serverMode";
import { useTheme } from "../theme";
import { FillGradient, ScanArtwork } from "./HomeArtwork";
import { Notice } from "./experience";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Tool = {
  title: string;
  description: string;
  icon: Icon;
  onPress: () => unknown;
};
type Shortcut = {
  title: string;
  source: string;
  icon?: Icon;
  tone?: keyof typeof palette;
};

const palette = {
  blue: ["#0079d9", "#dff0ff"],
  purple: ["#9016da", "#f1e4ff"],
  red: ["#fc155a", "#ffe2ed"],
  green: ["#00ac41", "#ddf8e8"],
  orange: ["#ff7512", "#fff0e1"],
  teal: ["#00a69e", "#d9f7f5"],
  yellow: ["#d59100", "#fff4d9"],
};
const groups: {
  key: string;
  title: string;
  icon: Icon;
  featured: Shortcut[];
  extra: string[];
}[] = [
  {
    key: "Organize",
    title: "Organize PDFs",
    icon: "layers-outline",
    featured: [
      {
        title: "Merge PDF",
        source: "Merge PDF",
        icon: "copy-outline",
        tone: "red",
      },
      { title: "Split PDF", source: "Split / extract pages", tone: "purple" },
      { title: "Remove Pages", source: "Remove pages" },
      {
        title: "Organize Pages",
        source: "Organize pages",
        icon: "layers-outline",
      },
    ],
    extra: ["Scan to PDF"],
  },
  {
    key: "Convert",
    title: "Convert PDFs",
    icon: "swap-horizontal-outline",
    featured: [
      { title: "PDF to Image", source: "PDF to JPG" },
      {
        title: "Image to PDF",
        source: "JPG to PDF",
        icon: "document-text-outline",
        tone: "green",
      },
      {
        title: "Word to PDF",
        source: "Office to PDF",
        icon: "document-text-outline",
      },
      {
        title: "Excel to PDF",
        source: "Office to PDF",
        icon: "grid-outline",
        tone: "green",
      },
    ],
    extra: ["Office to PDF", "PDF to PNG", "Text to PDF", "PDF to Markdown"],
  },
  {
    key: "Edit",
    title: "Edit & Enhance",
    icon: "pencil-outline",
    featured: [
      {
        title: "Edit PDF",
        source: "Sign / annotate PDF",
        icon: "pencil-outline",
        tone: "orange",
      },
      { title: "Compress PDF", source: "Compress PDF", tone: "teal" },
      { title: "Rotate PDF", source: "Rotate PDF", tone: "purple" },
      { title: "Add Watermark", source: "Watermark PDF" },
    ],
    extra: [
      "PDF filters",
      "Crop PDF",
      "Page numbers",
      "Fill PDF forms",
      "Sign / annotate PDF",
    ],
  },
  {
    key: "More",
    title: "More Tools",
    icon: "grid-outline",
    featured: [
      {
        title: "Extract Pages",
        source: "Split / extract pages",
        icon: "download-outline",
      },
      { title: "Add Password", source: "Protect / unlock PDF", tone: "red" },
      {
        title: "Remove Password",
        source: "Protect / unlock PDF",
        icon: "lock-open-outline",
        tone: "yellow",
      },
      { title: "PDF Info", source: "Edit PDF metadata", tone: "purple" },
    ],
    extra: [
      "Compare PDFs",
      "OCR / searchable PDF",
      "Translate document",
      "Extract text",
    ],
  },
];
const shadow = {
  elevation: 2,
  shadowColor: "#345084",
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 6,
  shadowOpacity: 0.13,
};

export function PdfWorkspaceCatalog({
  tools,
  shortcut,
  clearShortcut,
  progress,
}: {
  tools: Tool[];
  shortcut?: string;
  clearShortcut: () => void;
  progress: string;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showOptions, setShowOptions] = useState(false);
  const [showEveryTool, setShowEveryTool] = useState(false);
  const [busy, setBusy] = useState("");
  const pending = useRef(false);
  const search = (shortcut ?? query).trim().toLowerCase();
  const selectedCategory = shortcut ? "All" : category;
  const byTitle = new Map(tools.map((tool) => [tool.title, tool]));

  function setSection(value: string) {
    if (shortcut) clearShortcut();
    setCategory(value);
    setQuery("");
  }
  async function run(item: Shortcut, tool: Tool) {
    if (pending.current) return;
    if (
      !folioServerEnabled &&
      ["Office to PDF", "Protect / unlock PDF"].includes(item.source)
    ) {
      Alert.alert(
        item.title,
        "This tool requires Folio’s PDF processing server.",
      );
      return;
    }
    pending.current = true;
    setBusy(item.title);
    try {
      await tool.onPress();
    } catch (error) {
      Alert.alert(
        "Couldn't finish",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  const sections = groups
    .filter(
      (group) => selectedCategory === "All" || selectedCategory === group.key,
    )
    .map((group) => {
      const shortcuts =
        search || showEveryTool || selectedCategory === group.key
          ? [
              ...group.featured,
              ...group.extra.map((title) => ({ title, source: title })),
            ]
          : group.featured;
      const items = shortcuts.flatMap((item: Shortcut) => {
        const tool = byTitle.get(item.source);
        if (!tool) return [];
        if (
          search &&
          !`${item.title} ${tool.title} ${tool.description}`
            .toLowerCase()
            .includes(search)
        )
          return [];
        return [{ item, tool }];
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length);

  return (
    <View style={s.catalog}>
      <View style={s.brand}>
        <View style={s.brandIcon}>
          <FillGradient colors={["#198aff", "#0054ef"]} />
          <Ionicons name="scan-outline" size={23} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.wordmark, { color: t.primary }]}>folio.</Text>
          <Text
            style={{
              color: t.muted,
              fontWeight: "600",
              fontSize: narrow ? 9 : 10,
            }}
          >
            Document Scanner & PDF Editor
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pro plan"
          onPress={() => router.push("/subscription")}
          style={s.pro}
        >
          <MaterialCommunityIcons name="crown" size={18} color="#ffd423" />
          <Text style={s.proText}>PRO</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Backup settings"
          hitSlop={8}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="notifications-outline" size={23} color={t.text} />
        </Pressable>
      </View>
      <View style={s.hero}>
        <View style={s.heroCopy}>
          <Text
            style={[s.title, { color: t.text, fontSize: narrow ? 23 : 26 }]}
          >
            PDF Workspace
          </Text>
          <Text style={[s.subtitle, { color: t.muted }]}>
            All-in-one tools to organize, edit, convert and manage PDFs.
          </Text>
        </View>
        <View style={s.art} pointerEvents="none" accessible={false}>
          <ScanArtwork workspace />
        </View>
      </View>
      <View
        style={[
          s.search,
          shadow,
          { backgroundColor: t.surface, borderColor: t.line },
        ]}
      >
        <Ionicons name="search-outline" size={21} color={t.primary} />
        <TextInput
          accessibilityLabel="Search tools"
          placeholder="Search tools..."
          placeholderTextColor={t.muted}
          style={[s.input, { color: t.text }]}
          value={shortcut ?? query}
          onChangeText={(value) => {
            if (shortcut) clearShortcut();
            setQuery(value);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Catalog options"
          accessibilityState={{ expanded: showOptions }}
          hitSlop={8}
          onPress={() => setShowOptions(!showOptions)}
        >
          <Ionicons name="options-outline" size={22} color={t.primary} />
        </Pressable>
      </View>
      {showOptions && (
        <View style={s.chips}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSection("All");
              setShowEveryTool(!showEveryTool);
            }}
          >
            <Text style={{ color: t.primary, fontWeight: "700" }}>
              {showEveryTool ? "Show featured tools" : "Show every tool"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSection("All");
              setShowEveryTool(false);
            }}
          >
            <Text style={{ color: t.primary, fontWeight: "700" }}>
              Reset filters
            </Text>
          </Pressable>
        </View>
      )}
      <View style={s.chips}>
        {["All", ...groups.map((group) => group.key)].map((name) => {
          const active = selectedCategory === name;
          const icon = groups.find((group) => group.key === name)?.icon;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSection(name)}
              style={[
                s.chip,
                shadow,
                {
                  paddingHorizontal: narrow ? 7 : 10,
                  backgroundColor: active ? "#0562f6" : t.surface,
                  borderColor: active ? "#0562f6" : t.line,
                },
              ]}
            >
              {icon && (
                <Ionicons
                  name={icon}
                  size={narrow ? 13 : 16}
                  color={active ? "#fff" : t.primary}
                />
              )}
              <Text
                style={{
                  color: active ? "#fff" : t.text,
                  fontSize: narrow ? 10 : 11,
                  fontWeight: "800",
                }}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!!progress && <Notice message={progress} />}
      {sections.map((section) => (
        <View key={section.key} style={s.section}>
          <View style={s.heading}>
            <Ionicons name={section.icon} size={20} color={t.primary} />
            <Text style={[s.headingTitle, { color: t.text }]}>
              {section.title}
            </Text>
            {selectedCategory === "All" && !search && !showEveryTool && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all ${section.title}`}
                onPress={() => setSection(section.key)}
                style={s.link}
              >
                <Text
                  style={{ color: t.primary, fontSize: 12, fontWeight: "800" }}
                >
                  See All
                </Text>
                <Ionicons name="chevron-forward" size={14} color={t.primary} />
              </Pressable>
            )}
          </View>
          <View style={s.tiles}>
            {section.items.map(({ item, tool }) => {
              const [color, tint] = palette[item.tone ?? "blue"];
              return (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityHint={tool.description}
                  accessibilityState={{
                    busy: busy === item.title,
                    disabled: !!busy,
                  }}
                  disabled={!!busy}
                  onPress={() => void run(item, tool)}
                  style={({ pressed }) => [
                    s.tile,
                    shadow,
                    {
                      backgroundColor: t.surface,
                      borderColor: t.line,
                      opacity: pressed || busy === item.title ? 0.65 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.badge,
                      { backgroundColor: t.dark ? t.tint : tint },
                    ]}
                  >
                    <Ionicons
                      name={item.icon ?? tool.icon}
                      color={t.dark ? t.primary : color}
                      size={23}
                    />
                  </View>
                  <Text
                    style={[
                      s.tileLabel,
                      { color: t.text, fontSize: narrow ? 10 : 11 },
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {!sections.length && (
        <Notice message="No matching tools. Try PDF, translate, crop or merge." />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  catalog: { gap: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  wordmark: {
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  pro: {
    backgroundColor: "#0562f6",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  proText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  hero: { flexDirection: "row", alignItems: "center", minHeight: 103 },
  heroCopy: { flex: 1, gap: 8, zIndex: 1 },
  title: { fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 19, fontWeight: "500" },
  art: { width: "34%", height: 115 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 45,
    borderRadius: 24,
    paddingHorizontal: 13,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontWeight: "600", paddingVertical: 7 },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  section: { gap: 9, marginTop: 4 },
  heading: { flexDirection: "row", alignItems: "center", gap: 9 },
  headingTitle: { flex: 1, fontWeight: "900", fontSize: 17 },
  link: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 30 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: {
    width: "23%",
    flexGrow: 0,
    minHeight: 77,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 6,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tileLabel: { fontWeight: "800", textAlign: "center" },
});
