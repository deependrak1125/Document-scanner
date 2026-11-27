import * as Crypto from "expo-crypto";
import * as FS from "expo-file-system/legacy";
import { AdjustmentSlider } from "../components/AdjustmentSlider";
import { exportPdf } from "../features/documents/export";
import { Ionicons } from "@expo/vector-icons";
import { FilterStrip } from "../components/FilterStrip";
import { useTheme } from "../theme";
import { Disclosure } from "../components/experience";
import { Screen } from "../components/Screen";
import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  Pressable,
  Alert,
  Modal,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDraft, useSettings } from "../store";
import { Button, Card, Field, Label, layout } from "../components/ui";
import { CropEditor } from "../components/CropEditor";
import {
  AutoScannerUnavailableError,
  capture,
  importImages,
  rotatePage,
  makePage,
} from "../features/scanner";
import { processImage, detectCorners } from "../native/image";
import { imagesToPdf, type Paper } from "@folio/pdf";
import { readBytes, savePdf, scanFolderSettings } from "../database";
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
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const quality = useSettings((s) => s.quality);
  const { pages, idMode, past, future, undo, redo } = useDraft(),
    [index, setIndex] = useState(0),
    [title, setTitle] = useState(`Scan ${new Date().toLocaleDateString()}`),
    [before, setBefore] = useState(false),
    [previewOpen, setPreviewOpen] = useState(false),
    [fullOriginal, setFullOriginal] = useState(false),
    [menu, setMenu] = useState<"more" | "reorder" | null>(null),
    [allFilters, setAllFilters] = useState(false),
    [zoom, setZoom] = useState(1),
    [crop, setCrop] = useState(false),
    [paper, setPaper] = useState<Paper>("A4"),
    [horizontal, setHorizontal] = useState(false),
    [processing, setProcessing] = useState(false),
    [progress, setProgress] = useState("");
  const editing = useRef(false);
  const [cropAll, setCropAll] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const draggingAdjustment = useRef(false);
  const pendingAdjustment = useRef<
    { page: ScanPage; brightness: number; contrast: number } | undefined
  >(undefined);
  const adjustmentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const renderingAdjustment = useRef(false);
  const mounted = useRef(true);
  const [livePreview, setLivePreview] = useState<{
    pageId: string;
    uri: string;
  }>();
  const [adjustmentBusy, setAdjustmentBusy] = useState(false);
  const blocked = processing || adjustmentBusy;
  const [adjustment, setAdjustment] = useState<{
    pageUri: string;
    brightness: number;
    contrast: number;
  }>();
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, pages.length - 1)));
  }, [pages.length]);
  const page = pages[index];
  const values =
    adjustment?.pageUri === page?.uri
      ? adjustment
      : {
          pageUri: page?.uri,
          brightness: page?.brightness ?? 0,
          contrast: page?.contrast ?? 1,
        };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(adjustmentTimer.current);
      pendingAdjustment.current = undefined;
    };
  }, []);
  useEffect(() => {
    const uri = livePreview?.uri;
    return () => {
      if (uri && !useDraft.getState().pages.some((item) => item.uri === uri))
        void FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
    };
  }, [livePreview]);
  async function renderAdjustment() {
    if (renderingAdjustment.current || !mounted.current) return;
    const request = pendingAdjustment.current;
    if (!request) return;
    renderingAdjustment.current = true;
    try {
      const next = await processImage(
        request.page,
        request.page.filter,
        request.brightness,
        request.contrast,
      );
      const draft = useDraft.getState();
      if (
        !mounted.current ||
        !draft.pages.some(
          (item) =>
            item.id === request.page.id && item.uri === request.page.uri,
        )
      ) {
        void FS.deleteAsync(next.uri, { idempotent: true }).catch(() => {});
        if (mounted.current && pendingAdjustment.current === request) {
          pendingAdjustment.current = undefined;
          setLivePreview(undefined);
          setAdjustment(undefined);
        }
        return;
      }
      if (
        pendingAdjustment.current === request &&
        !draggingAdjustment.current
      ) {
        pendingAdjustment.current = undefined;
        draft.set(
          draft.pages.map((item) => (item.id === next.id ? next : item)),
        );
        setLivePreview(undefined);
        setAdjustment(undefined);
      } else {
        setLivePreview({ pageId: next.id, uri: next.uri });
      }
    } catch (error) {
      if (mounted.current) {
        pendingAdjustment.current = undefined;
        setLivePreview(undefined);
        setAdjustment(undefined);
        Alert.alert(
          "Adjustment failed",
          error instanceof Error ? error.message : "Try again.",
        );
      }
    } finally {
      renderingAdjustment.current = false;
      if (mounted.current) {
        if (
          pendingAdjustment.current &&
          (pendingAdjustment.current !== request || !draggingAdjustment.current)
        )
          scheduleAdjustment();
        else if (!pendingAdjustment.current) setAdjustmentBusy(false);
      }
    }
  }
  function scheduleAdjustment() {
    clearTimeout(adjustmentTimer.current);
    adjustmentTimer.current = setTimeout(() => {
      adjustmentTimer.current = undefined;
      void renderAdjustment();
    }, 90);
  }
  function updateAdjustment(next: { brightness: number; contrast: number }) {
    if (!page || editing.current) return;
    setAdjustment({ ...next, pageUri: page.uri });
    pendingAdjustment.current = { ...next, page };
    setAdjustmentBusy(true);
    if (!adjustmentTimer.current) scheduleAdjustment();
  }
  async function addScans() {
    try {
      useDraft.getState().add(await capture(idMode));
    } catch (error) {
      if (!(error instanceof AutoScannerUnavailableError)) throw error;
      Alert.alert("Auto scanner unavailable", error.message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use Folio camera",
          onPress: () =>
            router.push({ pathname: "/camera", params: { mode: "auto" } }),
        },
      ]);
    }
  }
  async function replace(operation: () => Promise<ScanPage>) {
    if (editing.current || pendingAdjustment.current)
      throw new Error("Wait for the current edit to finish.");
    editing.current = true;
    setProcessing(true);
    try {
      const next = await operation();
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
  async function retakePage() {
    if (!page || editing.current) return;
    editing.current = true;
    setProcessing(true);
    try {
      const [replacement] = await capture(idMode, 1);
      if (!replacement) return;
      const draft = useDraft.getState();
      if (!draft.pages.some((item) => item.id === page.id)) return;
      draft.set(
        draft.pages.map((item) => (item.id === page.id ? replacement : item)),
      );
      setCrop(false);
      setMenu(null);
    } finally {
      editing.current = false;
      setProcessing(false);
    }
  }
  async function save(toPhone = false) {
    if (editing.current || pendingAdjustment.current)
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
      const { folderId } = await scanFolderSettings();
      const doc = await savePdf(title, bytes, pages, idMode, folderId);
      useDraft.getState().clear();
      router.replace({
        pathname: "/document/[id]",
        params: { id: doc.id, saved: "1" },
      });
      if (toPhone) {
        try {
          const result = await exportPdf(doc);
          if (result === "saved")
            Alert.alert(
              "PDF saved to phone",
              "Your PDF is in the folder you selected.",
            );
        } catch {
          Alert.alert(
            "PDF saved",
            "Your PDF is safe in Folio. Tap Save to phone on the document screen to retry exporting.",
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
        <Button title="Scan a page" onPress={addScans} />
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
        {crop ? (
          <View style={{ gap: 6 }}>
            <CropEditor
              uri={page.uri}
              width={page.width}
              height={page.height}
              onApply={async (corners) => {
                if (cropAll && pages.length > 1) {
                  if (editing.current || pendingAdjustment.current)
                    throw new Error("Wait for the current edit to finish.");
                  editing.current = true;
                  setProcessing(true);
                  try {
                    const edited: ScanPage[] = [];
                    for (const [i, source] of pages.entries()) {
                      setProgress(`Cropping page ${i + 1} of ${pages.length}…`);
                      edited.push(
                        await processImage(
                          source,
                          source.filter,
                          source.brightness ?? 0,
                          source.contrast ?? 1,
                          corners,
                        ),
                      );
                    }
                    useDraft.getState().set(edited);
                    setCrop(false);
                  } finally {
                    editing.current = false;
                    setProcessing(false);
                    setProgress("");
                  }
                  return;
                }
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
            {pages.length > 1 && (
              <Button
                title={
                  cropAll ? "Crop target: All pages" : "Crop target: This page"
                }
                secondary
                disabled={blocked}
                onPress={() => setCropAll(!cropAll)}
              />
            )}
          </View>
        ) : (
          <View>
            <Pressable
              accessibilityLabel="Tap to enlarge preview; hold to view original"
              onPress={() => {
                setZoom(1);
                setFullOriginal(false);
                setPreviewOpen(true);
              }}
              onLongPress={() => setBefore(true)}
              onPressOut={() => setBefore(false)}
            >
              <Image
                source={{
                  uri: before
                    ? page.originalUri
                    : livePreview?.pageId === page.id
                      ? livePreview.uri
                      : page.uri,
                }}
                style={{
                  width: "100%",
                  height: Math.min(290, Math.max(145, screenHeight * 0.29)),
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: t.surface,
                  backgroundColor: t.tint,
                }}
                resizeMode="contain"
              />
            </Pressable>
            <Text
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                borderRadius: 10,
                overflow: "hidden",
                color: "white",
                backgroundColor: "#435470",
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              {index + 1} / {pages.length}
              {idMode ? " · ID" : ""}
            </Text>
            <View
              style={{ position: "absolute", bottom: 12, right: 10, gap: 7 }}
            >
              {(
                [
                  ["Full screen", "expand-outline", 1],
                  ["Zoom in", "add-circle-outline", 1.5],
                  ["Fit page", "remove-circle-outline", 1],
                ] as const
              ).map(([label, icon, scale]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => {
                    setZoom(scale);
                    setFullOriginal(false);
                    setPreviewOpen(true);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 22,
                    backgroundColor: t.surface,
                  }}
                >
                  <Ionicons name={icon} size={21} color={t.primary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!crop && !adjusting}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={layout.content}
      >
        <Card style={{ padding: 14 }}>
          <View style={{ ...layout.row, justifyContent: "space-between" }}>
            <Label size={19}>Choose a look</Label>
            <Button
              compact
              secondary
              title={allFilters ? "Show fewer" : "View filter previews"}
              onPress={() => setAllFilters(!allFilters)}
            />
          </View>
          <FilterStrip
            page={page}
            expanded={allFilters}
            generatePreviews={allFilters}
            disabled={blocked}
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
            {blocked
              ? "Updating preview…"
              : "Clean color whitens paper and keeps colored ink. Tap a thumbnail to preview the result."}
          </Label>
          {pages.length > 1 && (
            <Button
              title="Apply this look to all pages"
              secondary
              icon="color-filter-outline"
              disabled={blocked}
              onPress={applyToAll}
            />
          )}
        </Card>
        <Disclosure
          title="Fine adjustments"
          icon="options-outline"
          description="Brightness and contrast"
        >
          {(["brightness", "contrast"] as const).map((key) => (
            <AdjustmentSlider
              key={key}
              label={key === "brightness" ? "Brightness" : "Contrast"}
              value={values[key]}
              min={key === "brightness" ? -0.4 : 0.5}
              max={key === "brightness" ? 0.4 : 2}
              onDragging={(active) => {
                draggingAdjustment.current = active;
                setAdjusting(active);
                if (!active && pendingAdjustment.current) scheduleAdjustment();
              }}
              disabled={processing}
              onChange={(value) =>
                updateAdjustment({ ...values, [key]: value })
              }
            />
          ))}
          <Button
            title="Reset adjustments"
            secondary
            disabled={processing}
            onPress={() => updateAdjustment({ brightness: 0, contrast: 1 })}
          />
        </Disclosure>
        <View style={{ gap: 3 }}>
          <Field
            value={title}
            onChangeText={setTitle}
            placeholder="Document name"
          />
        </View>
        <View style={{ ...layout.row, justifyContent: "space-between" }}>
          <Label size={16}>Pages</Label>
          <Button
            title="Retake page"
            icon="camera-reverse-outline"
            secondary
            disabled={blocked}
            onPress={retakePage}
          />
        </View>
        <ScrollView horizontal contentContainerStyle={layout.row}>
          {pages.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => {
                if (blocked) return;
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add page"
            disabled={blocked}
            onPress={addScans}
            style={{
              width: 66,
              height: 72,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: t.primary,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add-outline" size={25} color={t.primary} />
            <Label size={11}>Add page</Label>
          </Pressable>
        </ScrollView>
        <View style={{ ...layout.row, gap: 5 }}>
          <Button
            title={crop ? "Cancel" : "Crop"}
            compact
            toolbar
            icon="crop-outline"
            disabled={blocked}
            secondary
            onPress={() => setCrop(!crop)}
          />
          <Button
            title="Rotate"
            disabled={blocked}
            compact
            toolbar
            icon="refresh-outline"
            secondary
            onPress={async () => replace(() => rotatePage(page))}
          />
          <Button
            title="Reorder"
            compact
            toolbar
            secondary
            icon="layers-outline"
            disabled={blocked || pages.length < 2}
            onPress={() => setMenu("reorder")}
          />
          <Button
            disabled={blocked}
            title="Remove"
            compact
            toolbar
            icon="trash-outline"
            secondary
            onPress={() => {
              useDraft.getState().set(pages.filter((_, i) => i !== index));
              setIndex(Math.max(0, index - 1));
            }}
          />
          <Button
            title="More"
            compact
            toolbar
            secondary
            icon="ellipsis-horizontal"
            disabled={blocked}
            onPress={() => setMenu("more")}
          />
        </View>
        <Modal
          visible={menu !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setMenu(null)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              padding: 20,
              backgroundColor: "#0007",
            }}
          >
            <Card>
              <Label size={21}>
                {menu === "reorder" ? "Reorder pages" : "Page options"}
              </Label>
              {menu === "reorder" ? (
                <>
                  <Button
                    title="Move earlier"
                    compact
                    icon="arrow-back-outline"
                    secondary
                    disabled={index === 0 || blocked}
                    onPress={() => {
                      const next = [...pages];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      useDraft.getState().set(next);
                      setIndex(index - 1);
                    }}
                  />
                  <Button
                    title="Move later"
                    compact
                    icon="arrow-forward-outline"
                    secondary
                    disabled={index >= pages.length - 1 || blocked}
                    onPress={() => {
                      const next = [...pages];
                      [next[index + 1], next[index]] = [
                        next[index],
                        next[index + 1],
                      ];
                      useDraft.getState().set(next);
                      setIndex(index + 1);
                    }}
                  />
                </>
              ) : (
                <>
                  <Button
                    title="Undo"
                    compact
                    secondary
                    icon="arrow-undo-outline"
                    disabled={blocked || !past.length}
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
                    disabled={blocked || !future.length}
                    onPress={() => {
                      setCrop(false);
                      redo();
                    }}
                  />
                  <Button
                    title="Detect & crop"
                    disabled={blocked}
                    compact
                    icon="scan-outline"
                    secondary
                    onPress={async () => {
                      const corners = await detectCorners(
                        page.editBaseUri ?? page.uri,
                      );
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
                    title="Reset"
                    disabled={blocked}
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
                </>
              )}
              {menu === "reorder" && (
                <Button
                  title="Reverse all pages"
                  icon="swap-vertical-outline"
                  secondary
                  disabled={blocked || pages.length < 2}
                  onPress={() => {
                    useDraft.getState().set([...pages].reverse());
                    setIndex(pages.length - 1 - index);
                    setMenu(null);
                  }}
                />
              )}
              <Button title="Done" onPress={() => setMenu(null)} />
            </Card>
          </View>
        </Modal>
        <Disclosure
          title="Pages & paper"
          icon="documents-outline"
          description="Rename, add pages and choose paper size"
        >
          <Field
            value={title}
            onChangeText={setTitle}
            placeholder="Document name"
          />
          <View style={layout.wrap}>
            <Button
              title="Duplicate selected page"
              icon="copy-outline"
              secondary
              disabled={blocked || idMode || pages.length >= 100}
              onPress={() => {
                const draft = useDraft.getState();
                const next = [...draft.pages];
                next.splice(index + 1, 0, { ...page, id: Crypto.randomUUID() });
                draft.set(next);
                setIndex(index + 1);
              }}
            />
            <Button
              title="Reverse page order"
              icon="swap-vertical-outline"
              secondary
              disabled={blocked || pages.length < 2}
              onPress={() => useDraft.getState().set([...pages].reverse())}
            />
            <Button
              title="Add scans"
              disabled={blocked}
              icon="camera-outline"
              secondary
              onPress={addScans}
            />
            <Button
              title="Add images"
              disabled={blocked}
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
                        : paper === "Auto"
                          ? "A3"
                          : paper === "A3"
                            ? "A5"
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
          disabled={blocked}
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
              title="Save to phone"
              secondary
              icon="download-outline"
              disabled={!title.trim() || blocked}
              onPress={() => save(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Save in app"
              icon="checkmark"
              disabled={!title.trim() || blocked}
              onPress={() => save()}
            />
          </View>
        </View>
      </View>
      <Modal
        visible={previewOpen}
        animationType="slide"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: t.bg, padding: 12, gap: 12 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              title="Close"
              secondary
              icon="close-outline"
              onPress={() => setPreviewOpen(false)}
            />
            <Button
              title={fullOriginal ? "Edited" : "Original"}
              secondary
              icon="swap-horizontal-outline"
              onPress={() => setFullOriginal(!fullOriginal)}
            />
          </View>
          <ScrollView style={{ flex: 1 }} nestedScrollEnabled>
            <ScrollView horizontal nestedScrollEnabled>
              <Image
                source={{ uri: fullOriginal ? page.originalUri : page.uri }}
                style={{
                  width: (screenWidth - 24) * zoom,
                  height:
                    ((screenWidth - 24) * zoom * page.height) / page.width,
                  backgroundColor: "#fff",
                }}
                resizeMode="contain"
              />
            </ScrollView>
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Button
              title="Zoom out"
              secondary
              compact
              icon="remove-outline"
              disabled={zoom <= 1}
              onPress={() => setZoom(Math.max(1, zoom - 0.5))}
            />
            <Label>{Math.round(zoom * 100)}%</Label>
            <Button
              title="Zoom in"
              secondary
              compact
              icon="add-outline"
              disabled={zoom >= 3}
              onPress={() => setZoom(Math.min(3, zoom + 0.5))}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
