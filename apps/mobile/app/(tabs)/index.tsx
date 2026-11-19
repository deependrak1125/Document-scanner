import { FolioBrand, FolioIllustration } from "../../components/FolioBrand";
import { Ionicons } from "@expo/vector-icons";
import { launchScanner } from "../../features/scanner/launch";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import {
  ScrollView,
  Pressable,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Label, Button, layout } from "../../components/ui";
import { ActionCard, Notice } from "../../components/experience";
import { DocumentList } from "../../components/DocumentList";
import { useLibrary } from "../../hooks/useLibrary";
import { importImages } from "../../features/scanner";
import { importPdf } from "../../features/documents/import";
import { useDraft, useSettings } from "../../store";
import { useTheme } from "../../theme";
export default function Home() {
  const t = useTheme(),
    { documents: docs, loading, error, reload } = useLibrary(),
    backup = useSettings((s) => s.backup);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[layout.content, { padding: 14, gap: 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading && docs.length > 0}
            onRefresh={() => void reload()}
            tintColor={t.primary}
          />
        }
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <FolioBrand />
          </View>
          <Button
            title="Profile"
            secondary
            icon="person-circle-outline"
            onPress={() => router.push("/profile")}
          />
        </View>
        <View style={layout.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <Label size={26}>Scan, edit & manage documents</Label>
            <Label muted size={13}>
              Capture pages and work with PDFs in one place.
            </Label>
          </View>
          <FolioIllustration />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={launchScanner}
          style={({ pressed }) => ({
            ...layout.row,
            backgroundColor: t.primary,
            borderRadius: 22,
            padding: 13,
            gap: 14,
            opacity: pressed ? 0.8 : 1,
            elevation: 3,
          })}
        >
          <Ionicons
            name="scan-outline"
            color={t.dark ? t.bg : "white"}
            size={32}
          />
          <View style={{ flex: 1 }}>
            <TextOnBlue
              title="Scan document"
              subtitle="Capture, enhance and create PDF"
            />
          </View>
          <Ionicons
            name="arrow-forward-circle"
            color={t.dark ? t.bg : "white"}
            size={30}
          />
        </Pressable>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <ActionCard
            tile
            short
            title="Photo to PDF"
            description="Choose photos"
            icon="images-outline"
            onPress={async () => {
              if (!(await confirmReplaceDraft())) return;
              const pages = await importImages();
              if (pages.length) {
                useDraft.getState().clear();
                useDraft.getState().add(pages);
                router.push("/editor");
              }
            }}
          />
          <ActionCard
            tile
            short
            title="Import PDF"
            description="Open a PDF file"
            icon="document-attach-outline"
            onPress={async () => {
              const doc = await importPdf();
              if (doc)
                router.push({
                  pathname: "/document/[id]",
                  params: { id: doc.id },
                });
            }}
          />
        </View>
        <View style={{ ...layout.row, justifyContent: "space-between" }}>
          <Label size={21}>PDF Tools</Label>
          <Button
            title="See all"
            compact
            secondary
            onPress={() => router.push("/tools")}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            rowGap: 8,
          }}
        >
          {(
            [
              ["Merge", "Merge PDF", "copy-outline", "#d93454"],
              ["Compress", "Compress PDF", "contract-outline", "#12834d"],
              ["Split", "Split / extract pages", "cut-outline", "#792be5"],
              ["Sign", "Sign / annotate PDF", "create-outline", "#ba6412"],
              ["Edit PDF", "PDF filters", "pencil-outline", "#0069db"],
              ["Rotate", "Rotate PDF", "refresh-outline", "#792be5"],
              ["Reorder", "Organize pages", "layers-outline", "#0073bf"],
              [
                "Protect",
                "Protect / unlock PDF",
                "lock-closed-outline",
                "#d93454",
              ],
            ] as const
          ).map(([label, tool, icon, color]) => (
            <Pressable
              key={tool}
              accessibilityRole="button"
              onPress={() =>
                tool === "Merge PDF"
                  ? router.push("/merge")
                  : router.push({ pathname: "/tools", params: { tool } })
              }
              style={({ pressed }) => ({
                width: "23.5%",
                minHeight: 64,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  borderRadius: 12,
                  padding: 7,
                  backgroundColor: t.dark ? t.tint : color + "16",
                }}
              >
                <Ionicons
                  name={icon}
                  size={22}
                  color={t.dark ? t.primary : color}
                />
              </View>
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 11 }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ ...layout.row, justifyContent: "space-between" }}>
          <Label size={21}>Recently added</Label>
          <Button
            title="View all"
            icon="arrow-forward-outline"
            secondary
            onPress={() => router.push("/documents")}
          />
        </View>
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
            onChange={() => void reload()}
          />
        )}
        <Notice
          message={
            backup
              ? "Cloud backup is enabled. Private ID scans stay on this device."
              : "Private by default. Your documents stay on this device unless you enable backup."
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TextOnBlue({ title, subtitle }: { title: string; subtitle: string }) {
  const t = useTheme();
  const color = t.dark ? t.bg : "white";
  return (
    <>
      <Text style={{ color, fontSize: 21, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color, fontSize: 12, marginTop: 3 }}>{subtitle}</Text>
    </>
  );
}
