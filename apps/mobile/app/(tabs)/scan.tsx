import { confirmReplaceDraft } from "../../features/scanner/draft";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Label, Card, layout } from "../../components/ui";
import {
  ActionCard,
  Chip,
  PageHeading,
  Notice,
} from "../../components/experience";
import { capture, importImages } from "../../features/scanner";
import { useDraft } from "../../store";
import { useTheme } from "../../theme";
import { useState } from "react";
export default function Scan() {
  const t = useTheme(),
    [mode, setMode] = useState<"document" | "id">("document"),
    draft = useDraft((s) => s.pages);
  async function start() {
    if (!(await confirmReplaceDraft())) return;
    const pages = await capture(mode === "id");
    if (pages.length) {
      useDraft.getState().clear();
      useDraft.getState().setIdMode(mode === "id");
      useDraft.getState().add(pages);
      router.push("/editor");
    }
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={layout.content}
      >
        <PageHeading
          eyebrow="Capture something useful"
          title="Scan a document"
          subtitle="A sharp PDF in just a few taps."
        />
        <View style={layout.row}>
          <Chip
            title="Document"
            icon="document-text-outline"
            selected={mode === "document"}
            onPress={() => setMode("document")}
          />
          <Chip
            title="ID card"
            icon="card-outline"
            selected={mode === "id"}
            onPress={() => setMode("id")}
          />
        </View>
        <Card
          style={{
            alignItems: "center",
            paddingVertical: 28,
            backgroundColor: t.tint,
            borderColor: t.tint,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 150,
              height: mode === "id" ? 100 : 180,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: t.primary,
              borderRadius: 20,
              padding: 20,
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
            }}
          >
            <Ionicons
              name={mode === "id" ? "card-outline" : "document-text-outline"}
              size={62}
              color={t.primary}
            />
            {mode !== "id" && (
              <View
                style={{
                  height: 5,
                  width: 70,
                  backgroundColor: t.primary,
                  opacity: 0.2,
                  borderRadius: 3,
                }}
              />
            )}
          </View>
          <Label size={20}>
            {mode === "id"
              ? "Both sides. One private PDF."
              : "Line it up. We'll find the edges."}
          </Label>
          <Label muted size={13}>
            {mode === "id"
              ? "ID scans stay on this device."
              : "Capture multiple pages in one session."}
          </Label>
        </Card>
        <Button
          title={mode === "id" ? "Scan ID card" : "Open scanner"}
          icon="camera-outline"
          onPress={start}
        />
        {draft.length > 0 && (
          <ActionCard
            title={`Continue editing · ${draft.length} pages`}
            description="Your unsaved scan is waiting here"
            icon="create-outline"
            accent
            onPress={() => router.push("/editor")}
          />
        )}
        <ActionCard
          title="Use manual camera"
          description="Works offline · adjust the crop after capture"
          icon="camera-outline"
          onPress={async () => {
            if (!(await confirmReplaceDraft())) return;
            useDraft.getState().clear();
            useDraft.getState().setIdMode(mode === "id");
            router.push("/camera");
          }}
        />
        <ActionCard
          title="Choose from photos"
          description="Use images already on your phone"
          icon="images-outline"
          onPress={async () => {
            if (!(await confirmReplaceDraft())) return;
            const pages = await importImages();
            if (pages.length) {
              useDraft.getState().clear();
              useDraft.getState().setIdMode(mode === "id");
              useDraft.getState().add(pages);
              router.push("/editor");
            }
          }}
        />
        <Notice message="For a clearer scan: use good light, a contrasting surface, and keep all four corners visible." />
        <Label muted size={11}>
          On Android, automatic scanning may need a one-time download. Manual
          camera is available offline.
        </Label>
      </ScrollView>
    </SafeAreaView>
  );
}
