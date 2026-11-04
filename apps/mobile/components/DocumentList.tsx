import { FlatList, Pressable, View, Image } from "react-native";
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
}: {
  documents: LocalDocument[];
  grid?: boolean;
  scroll?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  showScanAction?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useTheme();
  return (
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
          onPress={() =>
            router.push({ pathname: "/document/[id]", params: { id: item.id } })
          }
          style={{
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
          }}
        >
          {item.pages[0] ? (
            <Image
              source={{ uri: item.pages[0].uri }}
              style={{
                width: grid ? "100%" : 48,
                height: grid ? 140 : 62,
                borderRadius: 5,
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
                borderRadius: 5,
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
            <Label>
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
        </Pressable>
      )}
    />
  );
}
