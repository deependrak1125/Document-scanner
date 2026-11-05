import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateDocument } from "../database";
import { useState } from "react";
import { Modal, Alert, FlatList, Pressable, View, Image } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LocalDocument } from "@folio/shared-types";
import { Label, Card, Button } from "./ui";
import { useTheme } from "../theme";
export function DocumentList({
  documents,
  grid = false,
  scroll = true,
  emptyTitle = "Your first scan starts here",
  emptyMessage = "Scan a page or import a file. Your documents will appear here.",
  showScanAction = true,
  onRefresh,
  refreshing = false,
  onChange,
}: {
  documents: LocalDocument[];
  grid?: boolean;
  scroll?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  showScanAction?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onChange?: () => void;
}) {
  const t = useTheme();
  const [selected, setSelected] = useState<LocalDocument | null>(null);
  async function change(values: Parameters<typeof updateDocument>[1]) {
    if (!selected) return;
    await updateDocument(selected.id, values);
    setSelected(null);
    onChange?.();
  }
  return (
    <>
      <FlatList
        key={grid ? "grid" : "list"}
        scrollEnabled={scroll}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        data={documents}
        numColumns={grid ? 2 : 1}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 22 }}
        columnWrapperStyle={grid ? { gap: 10 } : undefined}
        ListEmptyComponent={
          <Card>
            <Ionicons name="documents-outline" size={38} color={t.primary} />
            <Label size={21}>{emptyTitle}</Label>
            <Label muted>{emptyMessage}</Label>
            {showScanAction && (
              <Button
                title="Scan a document"
                icon="scan-outline"
                onPress={() => router.push("/scan")}
              />
            )}
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
            accessibilityHint="Tap to open. Hold for document actions."
            onLongPress={() => setSelected(item)}
            onPress={() =>
              router.push({
                pathname: "/document/[id]",
                params: { id: item.id },
              })
            }
            style={({ pressed }) => ({
              opacity: pressed ? 0.75 : 1,
              flex: 1,
              maxWidth: grid ? "49%" : undefined,
              backgroundColor: t.surface,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: grid ? "column" : "row",
              gap: 14,
              alignItems: grid ? "stretch" : "center",
            })}
          >
            {item.pages[0] ? (
              <Image
                source={{ uri: item.pages[0].uri }}
                style={{
                  width: grid ? "100%" : 48,
                  height: grid ? 140 : 62,
                  borderRadius: 9,
                  backgroundColor: t.bg,
                }}
                resizeMode="contain"
              />
            ) : (
              <View
                style={{
                  height: grid ? 140 : 62,
                  width: grid ? "100%" : 48,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: t.tint,
                  borderRadius: 9,
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={28}
                  color={t.primary}
                />
              </View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Label numberOfLines={2}>
                {item.favorite ? "★ " : ""}
                {item.title}
              </Label>
              <Label muted size={12}>
                {item.pageCount} pages · {(item.fileSize / 1024).toFixed(0)} KB
              </Label>
              <Label muted size={11}>
                {item.sensitive
                  ? "Private · local only"
                  : item.syncState === "synced"
                    ? "Backed up"
                    : item.syncState === "conflict"
                      ? "Sync needs attention"
                      : "On this device"}
              </Label>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${item.title}`}
              onPress={(event) => {
                event.stopPropagation();
                setSelected(item);
              }}
              style={{ padding: 12, alignSelf: grid ? "flex-end" : "center" }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={t.muted} />
            </Pressable>
          </Pressable>
        )}
      />
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityLabel="Close document actions"
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={{ flex: 1 }}
          />
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                padding: 20,
                gap: 12,
                maxWidth: 760,
                width: "100%",
                alignSelf: "center",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: t.line,
                  alignSelf: "center",
                  marginBottom: 6,
                }}
              />
              <Label size={20} numberOfLines={2}>
                {selected?.title}
              </Label>
              <Label muted size={12}>
                {selected?.pageCount} pages ·{" "}
                {selected?.sensitive
                  ? "Private · local only"
                  : "Saved document"}
              </Label>
              <Button
                title="Share PDF"
                icon="share-outline"
                onPress={async () => {
                  if (selected)
                    await Sharing.shareAsync(selected.uri, {
                      mimeType: "application/pdf",
                    });
                }}
              />
              <Button
                title={
                  selected?.favorite ? "Remove favorite" : "Add to favorites"
                }
                secondary
                icon={selected?.favorite ? "star" : "star-outline"}
                onPress={() => change({ favorite: !selected?.favorite })}
              />
              <Button
                title={
                  selected?.deletedAt ? "Restore document" : "Move to trash"
                }
                secondary
                icon={
                  selected?.deletedAt ? "arrow-undo-outline" : "trash-outline"
                }
                onPress={() => {
                  if (selected?.deletedAt) return change({ deletedAt: null });
                  Alert.alert(
                    "Move to trash?",
                    "You can restore this document from the Trash tab in your library.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Move to trash",
                        style: "destructive",
                        onPress: () => {
                          void change({
                            deletedAt: new Date().toISOString(),
                          }).catch((e) =>
                            Alert.alert("Could not update document", String(e)),
                          );
                        },
                      },
                    ],
                  );
                }}
              />
              <Button
                title="Close"
                secondary
                onPress={() => setSelected(null)}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
