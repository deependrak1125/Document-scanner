import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { FilterStrip } from "../components/FilterStrip";
import { useTheme } from "../theme";
import { PageHeading, Disclosure } from "../components/experience";
import { Screen } from "../components/Screen";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Image, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useDraft, useSettings } from "../store";
import { Button, Field, Label, layout } from "../components/ui";
import { CropEditor } from "../components/CropEditor";
import {
  capture,
  importImages,
  rotatePage,
  makePage,
} from "../features/scanner";
import { processImage, detectCorners } from "../native/image";
import { recognize } from "../features/ocr";
import { imagesToPdf, type Paper } from "@folio/pdf";
import { readBytes, savePdf } from "../database";
import type { ScanPage } from "@folio/shared-types";
export default function Editor() {
  return (
    <Screen>
      <EditorContent />
    </Screen>
  );
}
function EditorContent() {
  const t = useTheme();
  const quality = useSettings((s) => s.quality);
  const { pages, idMode, past, future, undo, redo } = useDraft(),
    [index, setIndex] = useState(0),
    [title, setTitle] = useState(`Scan ${new Date().toLocaleDateString()}`),
    [before, setBefore] = useState(false),
    [crop, setCrop] = useState(false),
    [paper, setPaper] = useState<Paper>("A4"),
    [horizontal, setHorizontal] = useState(false),
    [processing, setProcessing] = useState(false),
    [progress, setProgress] = useState("");
  const editing = useRef(false);
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, pages.length - 1)));
  }, [pages.length]);
  const page = pages[index];
  async function replace(operation: () => Promise<ScanPage>) {
    if (editing.current)
      throw new Error("Wait for the current edit to finish.");
    editing.current = true;
    setProcessing(true);
    try {
      const next = await operation();
      if (next.text === "")
        Alert.alert(
          "No text found",
          "Try a sharper scan, select the correct language, or use the Original filter.",
        );
      useDraft
        .getState()
        .set(
          useDraft.getState().pages.map((p) => (p.id === next.id ? next : p)),
        );
    } finally {
      editing.current = false;
      setProcessing(false);
    }
  }
  async function save(share = false) {
    if (editing.current)
      throw new Error("Wait for the preview to finish updating.");
    if (idMode && pages.length !== 2)
      throw new Error("An ID scan needs exactly two pages: front and back.");
    editing.current = true;
    setProcessing(true);
    try {
      const images = [];
      for (const [i, p] of pages.entries()) {
        setProgress(`Preparing page ${i + 1} of ${pages.length}…`);
        images.push({ bytes: await readBytes(p.uri), type: "jpg" as const });
      }
      setProgress("Saving PDF to your library…");
      const bytes = await imagesToPdf(images, {
        paper,
        idLayout: idMode ? (horizontal ? "horizontal" : "vertical") : undefined,
      });
      const doc = await savePdf(title, bytes, pages, idMode);
      useDraft.getState().clear();
      router.replace({ pathname: "/document/[id]", params: { id: doc.id } });
      if (share) {
        try {
          await Sharing.shareAsync(doc.uri, { mimeType: "application/pdf" });
        } catch {
          Alert.alert(
            "PDF saved",
            "Sharing could not open. Your PDF is safe in the library; open it and tap Share.",
          );
        }
      }
    } finally {
      editing.current = false;
      setProcessing(false);
      setProgress("");
    }
  }
  async function applyToAll() {
    if (editing.current || !page) return;
    editing.current = true;
    setProcessing(true);
    try {
      const updated: ScanPage[] = [];
      for (const [i, source] of pages.entries()) {
        setProgress(`Enhancing page ${i + 1} of ${pages.length}…`);
        updated.push(
          await processImage(
            source,
            page.filter,
            page.brightness ?? 0,
            page.contrast ?? 1,
          ),
        );
      }
      useDraft.getState().set(updated);
    } finally {
      editing.current = false;
      setProcessing(false);
      setProgress("");
    }
  }
  if (!page)
    return (
      <View style={layout.content}>
        <Label>No pages yet.</Label>
        {!!past.length && (
          <Button
            title="Undo remove page"
            icon="arrow-undo-outline"
            onPress={undo}
          />
        )}
        <Button
          title="Scan a page"
          onPress={async () => useDraft.getState().add(await capture(idMode))}
        />
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        scrollEnabled={!crop}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={layout.content}
      >
        <PageHeading
          eyebrow="Your scan, your way"
          title="Perfect your scan"
          subtitle="Crop, enhance and save a clear PDF."
        />
        <View style={layout.row}>
          <Button
            title="Undo"
            compact
            secondary
            icon="arrow-undo-outline"
            disabled={processing || !past.length}
            onPress={() => {
              setCrop(false);
              undo();
            }}
          />
          <Button
            title="Redo"
            compact
            secondary
            icon="arrow-redo-outline"
            disabled={processing || !future.length}
            onPress={() => {
              setCrop(false);
              redo();
            }}
          />
          <Label muted size={12}>
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </Label>
        </View>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Document name"
        />
        <Label muted>
          Page {index + 1} of {pages.length}
          {idMode ? " · Private ID scan" : ""}
        </Label>
        {crop ? (
          <CropEditor
            uri={page.uri}
            width={page.width}
            height={page.height}
            onApply={async (corners) => {
              await replace(() =>
                processImage(
                  page,
                  page.filter,
                  page.brightness ?? 0,
                  page.contrast ?? 1,
                  corners,
                ),
              );
              setCrop(false);
            }}
          />
        ) : (
          <Pressable
            accessibilityLabel="Hold to view original"
            onPressIn={() => setBefore(true)}
            onPressOut={() => setBefore(false)}
          >
            <Image
              source={{ uri: before ? page.originalUri : page.uri }}
              style={{ width: "100%", height: 350, borderRadius: 12 }}
              resizeMode="contain"
            />
          </Pressable>
        )}
        <Label muted size={12}>
          Hold the preview to compare with the source scan.
        </Label>
        <ScrollView horizontal contentContainerStyle={layout.row}>
          {pages.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => {
                if (processing) return;
                setIndex(i);
                setCrop(false);
              }}
              accessibilityLabel={`Select page ${i + 1}`}
            >
              <Image
                source={{ uri: p.uri }}
                style={{
                  width: 54,
                  height: 72,
                  borderWidth: 2,
                  borderColor: i === index ? "#087f75" : "transparent",
                  borderRadius: 6,
                }}
              />
            </Pressable>
          ))}
        </ScrollView>
        <View style={layout.wrap}>
          <Button
            title={crop ? "Cancel" : "Crop"}
            compact
            icon="crop-outline"
            disabled={processing}
            secondary
            onPress={() => setCrop(!crop)}
          />
          <Button
            title="Detect & crop"
            disabled={processing}
            compact
            icon="scan-outline"
            secondary
            onPress={async () => {
              const corners = await detectCorners(page.uri);
              if (corners.length !== 4)
                throw new Error(
                  "No confident document boundary found. Use the manual crop handles.",
                );
              await replace(() =>
                processImage(
                  page,
                  page.filter,
                  page.brightness ?? 0,
                  page.contrast ?? 1,
                  corners,
                ),
              );
            }}
          />
          <Button
            title="Rotate"
            disabled={processing}
            compact
            icon="refresh-outline"
            secondary
            onPress={async () => replace(() => rotatePage(page))}
          />
          <Button
            title="Reset"
            disabled={processing}
            compact
            icon="refresh-circle-outline"
            secondary
            onPress={async () =>
              replace(async () => ({
                ...(await makePage(page.originalUri)),
                id: page.id,
                originalUri: page.originalUri,
              }))
            }
          />
          <Button
            title="Move earlier"
            compact
            icon="arrow-back-outline"
            secondary
            disabled={index === 0 || processing}
            onPress={() => {
              const next = [...pages];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              useDraft.getState().set(next);
              setIndex(index - 1);
            }}
          />
          <Button
            title="Move later"
            compact
            icon="arrow-forward-outline"
            secondary
            disabled={index >= pages.length - 1 || processing}
            onPress={() => {
              const next = [...pages];
              [next[index + 1], next[index]] = [next[index], next[index + 1]];
              useDraft.getState().set(next);
              setIndex(index + 1);
            }}
          />
          <Button
            disabled={processing}
            title="Remove page"
            compact
            icon="trash-outline"
            secondary
            onPress={() => {
              useDraft.getState().set(pages.filter((_, i) => i !== index));
              setIndex(Math.max(0, index - 1));
            }}
          />
        </View>
        <Label size={18}>Make it clearer</Label>
        <FilterStrip
          page={page}
          disabled={processing}
          onSelect={(filter) =>
            replace(() =>
              processImage(
                page,
                filter,
                filter === "original" ? 0 : (page.brightness ?? 0),
                filter === "original" ? 1 : (page.contrast ?? 1),
              ),
            )
          }
        />
        <Label muted size={12}>
          {processing
            ? "Updating preview…"
            : "Clean color whitens the paper while preserving colored ink. Switching presets starts from the unfiltered page."}
        </Label>
        {pages.length > 1 && (
          <Button
            title="Apply this look to all pages"
            secondary
            icon="color-filter-outline"
            disabled={processing}
            onPress={applyToAll}
          />
        )}
        <Disclosure
          title="Fine adjustments"
          icon="options-outline"
          description="Brightness and contrast"
        >
          <View style={layout.wrap}>
            <Button
              title="Darker"
              compact
              icon="remove-circle-outline"
              secondary
              disabled={processing || (page.brightness ?? 0) <= -0.4}
              onPress={() =>
                replace(() =>
                  processImage(
                    page,
                    page.filter,
                    Math.max(-0.4, (page.brightness ?? 0) - 0.05),
                  ),
                )
              }
            />
            <Button
              title="Brighter"
              compact
              icon="sunny-outline"
              secondary
              disabled={processing || (page.brightness ?? 0) >= 0.4}
              onPress={() =>
                replace(() =>
                  processImage(
                    page,
                    page.filter,
                    Math.min(0.4, (page.brightness ?? 0) + 0.05),
                  ),
                )
              }
            />
            <Button
              title="Less contrast"
              compact
              icon="remove-outline"
              secondary
              disabled={processing || (page.contrast ?? 1) <= 0.5}
              onPress={() =>
                replace(() =>
                  processImage(
                    page,
                    page.filter,
                    page.brightness ?? 0,
                    Math.max(0.5, (page.contrast ?? 1) - 0.1),
                  ),
                )
              }
            />
            <Button
              title="More contrast"
              compact
              icon="add-outline"
              secondary
              disabled={processing || (page.contrast ?? 1) >= 2}
              onPress={() =>
                replace(() =>
                  processImage(
                    page,
                    page.filter,
                    page.brightness ?? 0,
                    Math.min(2, (page.contrast ?? 1) + 0.1),
                  ),
                )
              }
            />
          </View>
        </Disclosure>
        <Disclosure
          title="Recognize text"
          icon="scan-outline"
          description="Read English or Hindi, right on your device"
        >
          <View style={layout.row}>
            <Button
              secondary
              title="English"
              onPress={async () => replace(() => recognize(page, "latin"))}
            />
            <Button
              secondary
              title="Hindi"
              onPress={async () => replace(() => recognize(page, "devanagari"))}
            />
          </View>
          {page.text && (
            <>
              <Label>{page.text}</Label>
              <Button
                title="Copy recognized text"
                secondary
                icon="copy-outline"
                onPress={() => Clipboard.setStringAsync(page.text!)}
              />
            </>
          )}
        </Disclosure>
        <Disclosure
          title="Pages & paper"
          icon="documents-outline"
          description="Add pages and choose paper size"
        >
          <View style={layout.wrap}>
            <Button
              title="Add scans"
              disabled={processing}
              icon="camera-outline"
              secondary
              onPress={async () =>
                useDraft.getState().add(await capture(idMode))
              }
            />
            <Button
              title="Add images"
              disabled={processing}
              icon="images-outline"
              secondary
              onPress={async () =>
                useDraft.getState().add(await importImages())
              }
            />
            <Button
              title={`Paper: ${paper}`}
              secondary
              onPress={() =>
                setPaper(
                  paper === "A4"
                    ? "Letter"
                    : paper === "Letter"
                      ? "Legal"
                      : paper === "Legal"
                        ? "Auto"
                        : "A4",
                )
              }
            />
            {idMode && (
              <Button
                title={horizontal ? "Side by side" : "Stacked sides"}
                secondary
                onPress={() => setHorizontal(!horizontal)}
              />
            )}
          </View>
        </Disclosure>
        <Label muted size={12}>
          Saved locally as an image PDF. Recognized text is saved for local
          search. Use “Searchable PDF” in document details to embed a text
          layer.
        </Label>
        <Button
          title="Discard this scan"
          disabled={processing}
          secondary
          onPress={() =>
            Alert.alert(
              "Discard scan?",
              "Unsaved pages will be removed from this session.",
              [
                { text: "Keep editing", style: "cancel" },
                {
                  text: "Discard",
                  style: "destructive",
                  onPress: () => {
                    useDraft.getState().clear();
                    router.back();
                  },
                },
              ],
            )
          }
        />
        <Label muted size={11}>
          Scan quality: {quality}%
        </Label>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderColor: t.line,
          backgroundColor: t.surface,
        }}
      >
        {!!progress && (
          <Label muted size={12}>
            {progress}
          </Label>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Save PDF"
              icon="checkmark"
              disabled={!title.trim() || processing}
              onPress={() => save()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Save & share"
              secondary
              icon="share-outline"
              disabled={!title.trim() || processing}
              onPress={() => save(true)}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
