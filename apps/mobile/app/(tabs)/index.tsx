import { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  FillGradient,
  HomeWaves,
  ScanArtwork,
} from "../../components/HomeArtwork";
import { Button } from "../../components/ui";
import { Notice } from "../../components/experience";
import { DocumentList } from "../../components/DocumentList";
import { useLibrary } from "../../hooks/useLibrary";
import { launchScanner } from "../../features/scanner/launch";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import { importImages } from "../../features/scanner";
import { importPdf } from "../../features/documents/import";
import { useDraft } from "../../store";
import { useTheme } from "../../theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];
const tools = [
  ["Merge", "Merge PDF", "copy-outline", "#ea2850", "#ffe8ee"],
  ["Compress", "Compress PDF", "contract-outline", "#009445", "#ddf7ec"],
  ["Split", "Split / extract pages", "cut-outline", "#8c16d2", "#f3e7ff"],
  ["Sign", "Sign / annotate PDF", "create-outline", "#d9720a", "#fff0dd"],
  ["Edit PDF", "PDF filters", "pencil-outline", "#0068ee", "#e4f1ff"],
  ["Rotate", "Rotate PDF", "refresh-outline", "#8c16d2", "#f3e7ff"],
  ["Reorder", "Organize pages", "layers-outline", "#008a9c", "#ddf7fa"],
  [
    "Extract",
    "Split / extract pages",
    "document-text-outline",
    "#007cce",
    "#e5f4ff",
  ],
] as const;
const shadow = {
  elevation: 3,
  shadowColor: "#375eaf",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
};

export default function Home() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { documents: docs, loading, error, reload } = useLibrary();
  const pending = useRef(false);
  const compact = width < 360;
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    try {
      await action();
    } catch (reason) {
      Alert.alert(
        "Could not open file",
        reason instanceof Error ? reason.message : "Try again.",
      );
    } finally {
      pending.current = false;
    }
  }
  async function photos() {
    if (!(await confirmReplaceDraft())) return;
    const pages = await importImages();
    if (!pages.length) return;
    useDraft.getState().clear();
    useDraft.getState().add(pages);
    router.push("/editor");
  }
  async function pdf() {
    const doc = await importPdf();
    if (doc)
      router.push({ pathname: "/document/[id]", params: { id: doc.id } });
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {!t.dark && <FillGradient colors={["#e6efff", "#f9fafc"]} />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 15,
          paddingTop: 12,
          paddingBottom: 24,
          gap: 14,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading && docs.length > 0}
            onRefresh={() => void reload()}
            tintColor={t.primary}
          />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FillGradient colors={["#009aff", "#063ab5"]} />
            <Ionicons name="scan-outline" color="#fff" size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: t.text,
                fontSize: 32,
                lineHeight: 34,
                letterSpacing: -1.8,
                fontWeight: "900",
              }}
            >
              folio<Text style={{ color: t.primary }}>.</Text>
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: t.muted, fontSize: compact ? 10 : 11 }}
            >
              Document Scanner & PDF Editor
            </Text>
          </View>
          <RoundAction
            label="Backup settings"
            icon="cloud-outline"
            onPress={() => router.push("/profile")}
          />
          <RoundAction
            label="Profile"
            icon="person"
            onPress={() => router.push("/profile")}
          />
        </View>
        <View
          style={{
            marginHorizontal: -15,
            paddingHorizontal: 18,
            minHeight: 155,
            justifyContent: "center",
            paddingVertical: 14,
          }}
        >
          {!t.dark && <HomeWaves fadeBottom />}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, zIndex: 1 }}>
              <Text
                style={{
                  color: t.text,
                  fontSize: compact ? 21 : 24,
                  lineHeight: compact ? 25 : 29,
                  fontWeight: "900",
                  letterSpacing: -0.65,
                }}
              >
                Scan, Edit & Manage Documents{" "}
                <Text style={{ color: t.primary }}>Easily</Text>
              </Text>
              <Text
                style={{
                  color: t.muted,
                  fontSize: 12,
                  lineHeight: 17,
                  marginTop: 9,
                }}
              >
                Capture documents, convert to PDF, edit, organize and share.
              </Text>
            </View>
            <View style={{ width: compact ? 103 : 128, height: 142 }}>
              <ScanArtwork />
            </View>
          </View>
        </View>
        <View style={shadow}>
          <Pressable
            accessibilityRole="button"
            onPress={launchScanner}
            style={({ pressed }) => ({
              minHeight: 76,
              backgroundColor: "#2638df",
              borderRadius: 21,
              overflow: "hidden",
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <FillGradient colors={["#008efb", "#2638df"]} />
            <Ionicons name="scan-outline" color="#fff" size={35} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: compact ? 18 : 21,
                  fontWeight: "900",
                }}
              >
                Scan Document
              </Text>
              <Text style={{ color: "#eef5ff", fontSize: 12, marginTop: 3 }}>
                Capture, enhance and create PDF
              </Text>
            </View>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#f3f7ff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="#1647ea" />
            </View>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 11 }}>
          <ImportCard
            title="Photo to PDF"
            description="Convert photos to a single PDF"
            icon="images-outline"
            onPress={() => void run(photos)}
          />
          <ImportCard
            title="Import PDF"
            description="Open a PDF from your device"
            icon="document-outline"
            green
            onPress={() => void run(pdf)}
          />
        </View>
        <Section
          title="PDF Tools"
          action="See All"
          onPress={() => router.push("/tools")}
        />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 9,
          }}
        >
          {tools.map(([label, tool, icon, color, tint]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() =>
                tool === "Merge PDF"
                  ? router.push("/merge")
                  : router.push({ pathname: "/tools", params: { tool } })
              }
              style={({ pressed }) => ({
                ...shadow,
                width: "23.5%",
                minHeight: 76,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: t.line,
                backgroundColor: t.surface,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                paddingVertical: 7,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  padding: 7,
                  borderRadius: 13,
                  backgroundColor: t.dark ? t.tint : tint,
                }}
              >
                <Ionicons
                  name={icon}
                  size={24}
                  color={t.dark ? t.primary : color}
                />
              </View>
              <Text
                style={{
                  color: t.text,
                  fontSize: compact ? 10 : 12,
                  fontWeight: "800",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Section
          title="Recent Documents"
          icon="time-outline"
          action="View All"
          onPress={() => router.push("/documents")}
        />
        {error ? (
          <>
            <Notice error message={error} />
            <Button title="Try again" secondary onPress={reload} />
          </>
        ) : loading && !docs.length ? (
          <ActivityIndicator color={t.primary} />
        ) : (
          <DocumentList
            documents={docs.slice(0, 5)}
            scroll={false}
            compact
            onChange={() => void reload()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: t.tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={22} color={t.primary} />
    </Pressable>
  );
}

function ImportCard({
  title,
  description,
  icon,
  green,
  onPress,
}: {
  title: string;
  description: string;
  icon: Icon;
  green?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const color = t.dark ? t.primary : green ? "#008a54" : "#0956ec";
  return (
    <View style={{ ...shadow, flex: 1 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => ({
          padding: 13,
          minHeight: 125,
          borderRadius: 19,
          borderWidth: 1,
          borderColor: t.dark ? t.line : "#fff",
          backgroundColor: t.dark ? t.surface : green ? "#bdeee3" : "#d9e5ff",
          overflow: "hidden",
          gap: 5,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {!t.dark && (
          <FillGradient
            colors={green ? ["#f1fcfa", "#bdeee3"] : ["#f5f7ff", "#d9e5ff"]}
          />
        )}
        <View
          style={{
            padding: 7,
            borderRadius: 11,
            backgroundColor: t.dark ? t.tint : green ? "#c1f0e2" : "#d5e3ff",
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "900" }}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text
            style={{ flex: 1, color: t.muted, fontSize: 11, lineHeight: 15 }}
          >
            {description}
          </Text>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color={color}
          />
        </View>
      </Pressable>
    </View>
  );
}

function Section({
  title,
  action,
  icon,
  onPress,
}: {
  title: string;
  action: string;
  icon?: Icon;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: 3,
      }}
    >
      {icon && <Ionicons name={icon} size={21} color={t.text} />}
      <Text
        accessibilityRole="header"
        style={{ flex: 1, color: t.text, fontSize: 19, fontWeight: "900" }}
      >
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Text style={{ color: t.primary, fontSize: 13, fontWeight: "800" }}>
          {action}
        </Text>
        <Ionicons name="chevron-forward" color={t.primary} size={15} />
      </Pressable>
    </View>
  );
}
