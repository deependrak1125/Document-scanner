import { confirmReplaceDraft } from "../../features/scanner/draft";
import {
  ScrollView,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Label, Card, Button, layout } from "../../components/ui";
import { ActionCard, PageHeading, Notice } from "../../components/experience";
import { DocumentList } from "../../components/DocumentList";
import { useLibrary } from "../../hooks/useLibrary";
import { importImages } from "../../features/scanner";
import { importPdf } from "../../features/documents/import";
import { useDraft, useSettings } from "../../store";
import { useAuth } from "../../features/auth";
import { useTheme } from "../../theme";
export default function Home() {
  const t = useTheme(),
    { documents: docs, loading, error, reload } = useLibrary(),
    backup = useSettings((s) => s.backup),
    user = useAuth((s) => s.user);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={layout.content}
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
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: t.primary,
              letterSpacing: -1.5,
            }}
          >
            folio.
          </Text>
          <Button
            title={user?.name.split(" ")[0] || "My space"}
            secondary
            icon="person-circle-outline"
            onPress={() => router.push("/profile")}
          />
        </View>
        <PageHeading
          eyebrow="A little less paper"
          title={
            user
              ? `Hello, ${user.name.split(" ")[0]}.`
              : "Your paperwork,\nsorted."
          }
          subtitle="Scan it. Save it. Find it when you need it."
        />
        <View
          style={{
            backgroundColor: "#14345c",
            borderRadius: 28,
            padding: 24,
            gap: 18,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <View style={{ flex: 1, gap: 10 }}>
              <Text
                style={{
                  color: "#a8d7ff",
                  fontSize: 11,
                  fontWeight: "800",
                  letterSpacing: 2,
                }}
              >
                PAPER → PDF
              </Text>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 26,
                  fontWeight: "700",
                  lineHeight: 32,
                }}
              >
                Scan. Save. Share.
              </Text>
              <Text style={{ color: "#c4d9f3", fontSize: 13, lineHeight: 20 }}>
                Capture one page or a whole stack.
              </Text>
            </View>
            <View
              style={{
                width: 80,
                height: 106,
                borderRadius: 10,
                backgroundColor: "#f2f7ff",
                transform: [{ rotate: "8deg" }],
                padding: 13,
                gap: 9,
              }}
            >
              <Ionicons name="scan-outline" size={32} color="#1665d8" />
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    height: 4,
                    width: i === 3 ? "55%" : "100%",
                    backgroundColor: "#c6daf2",
                    borderRadius: 2,
                  }}
                />
              ))}
            </View>
          </View>
          <Button
            title="Start scanning"
            icon="scan-outline"
            onPress={() => router.push("/scan")}
          />
        </View>
        <View style={layout.row}>
          {[
            { value: docs.length, label: "Documents" },
            {
              value: docs.filter((d) => d.favorite).length,
              label: "Favorites",
            },
            {
              value: `${(docs.reduce((n, d) => n + d.fileSize, 0) / 1048576).toFixed(1)} MB`,
              label: "On device",
            },
          ].map((item) => (
            <Card key={item.label} style={{ flex: 1, padding: 14, gap: 3 }}>
              <Label size={21}>{item.value}</Label>
              <Label muted size={11}>
                {item.label}
              </Label>
            </Card>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <ActionCard
            tile
            title="Photo to PDF"
            description="Turn existing photos into a clean PDF"
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
            title="Import PDF"
            description="Keep your files together in one place"
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
