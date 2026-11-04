import { useCallback, useState } from "react";
import { ActivityIndicator, View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Button, Field, Label, Card, layout } from "../../components/ui";
import { PageHeading, Chip, Notice } from "../../components/experience";
import { DocumentList } from "../../components/DocumentList";
import { createFolder, folders } from "../../database";
import { useLibrary } from "../../hooks/useLibrary";
import { useTheme } from "../../theme";
export default function Documents() {
  const t = useTheme(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState<"all" | "favorites" | "trash">("all"),
    [grid, setGrid] = useState(false),
    [sort, setSort] = useState<"date" | "name" | "size">("date"),
    [folder, setFolder] = useState<string | null>(null),
    [allFolders, setFolders] = useState<{ id: string; name: string }[]>([]),
    [newFolder, setNewFolder] = useState(""),
    [showFolder, setShowFolder] = useState(false);
  const { documents, loading, error, reload } = useLibrary(
    query,
    filter === "trash",
    sort,
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void folders()
        .then((result) => {
          if (active) setFolders(result);
        })
        .catch((e) => {
          if (active) Alert.alert("Couldn't load folders", String(e));
        });
      return () => {
        active = false;
      };
    }, []),
  );
  const visible = documents.filter(
    (d) =>
      (filter !== "favorites" || d.favorite) &&
      (!folder || d.folderId === folder),
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View style={[layout.content, { flex: 1, paddingBottom: 0, gap: 14 }]}>
        <PageHeading
          eyebrow="Your library"
          title="Everything in place."
          subtitle="Search your files, including recognized text."
        />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search documents…"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={layout.row}
        >
          {(
            [
              ["all", "All files", "documents-outline"],
              ["favorites", "Favorites", "star-outline"],
              ["trash", "Trash", "trash-outline"],
            ] as const
          ).map(([key, title, icon]) => (
            <Chip
              key={key}
              title={title}
              icon={icon}
              selected={filter === key}
              onPress={() => setFilter(key)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={layout.row}
        >
          <Chip
            title="All folders"
            icon="folder-open-outline"
            selected={!folder}
            onPress={() => setFolder(null)}
          />
          {allFolders.map((f) => (
            <Chip
              key={f.id}
              title={f.name}
              selected={folder === f.id}
              onPress={() => setFolder(f.id)}
            />
          ))}
          <Chip
            title="New folder"
            icon="add"
            selected={showFolder}
            onPress={() => setShowFolder(!showFolder)}
          />
        </ScrollView>
        {showFolder && (
          <Card style={{ padding: 14 }}>
            <Field
              value={newFolder}
              onChangeText={setNewFolder}
              placeholder="Folder name"
            />
            <View style={layout.row}>
              <Button
                title="Create folder"
                disabled={!newFolder.trim()}
                onPress={async () => {
                  await createFolder(newFolder.trim());
                  setFolders(await folders());
                  setNewFolder("");
                  setShowFolder(false);
                }}
              />
              <Button
                title="Cancel"
                secondary
                onPress={() => setShowFolder(false)}
              />
            </View>
          </Card>
        )}
        <View
          style={{
            ...layout.row,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Label muted size={12}>
            {visible.length} {visible.length === 1 ? "document" : "documents"}
          </Label>
          <View style={layout.row}>
            <Chip
              title={{ date: "Recent", name: "A–Z", size: "Size" }[sort]}
              icon="swap-vertical"
              onPress={() =>
                setSort(
                  sort === "date" ? "name" : sort === "name" ? "size" : "date",
                )
              }
            />
            <Chip
              title={grid ? "List" : "Grid"}
              icon={grid ? "list" : "grid-outline"}
              onPress={() => setGrid(!grid)}
            />
          </View>
        </View>
        {error ? (
          <>
            <Notice error message={error} />
            <Button title="Try again" onPress={reload} />
          </>
        ) : loading && !documents.length ? (
          <ActivityIndicator style={{ padding: 30 }} color={t.primary} />
        ) : (
          <DocumentList
            documents={visible}
            grid={grid}
            refreshing={loading}
            onRefresh={() => void reload()}
            emptyTitle={
              query
                ? "No matches yet"
                : filter === "trash"
                  ? "Your trash is empty"
                  : filter === "favorites"
                    ? "Keep your favorites close"
                    : folder
                      ? "This folder is ready"
                      : "Your first scan starts here"
            }
            emptyMessage={
              query
                ? "Try a different name or a word from recognized text."
                : filter === "trash"
                  ? "Deleted files appear here. Open a file to restore it."
                  : filter === "favorites"
                    ? "Open a document and tap Favorite to find it here."
                    : folder
                      ? "Open a document and choose this folder to organize it."
                      : undefined
            }
            showScanAction={!query && filter === "all" && !folder}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
