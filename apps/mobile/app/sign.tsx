import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { PDFDocument } from "pdf-lib";
import { editPdf } from "@folio/pdf";
import type { LocalDocument } from "@folio/shared-types";
import { Screen } from "../components/Screen";
import { SignaturePad } from "../components/SignaturePad";
import { SignaturePlacement } from "../components/SignaturePlacement";
import { Button, Label, layout } from "../components/ui";
import {
  getDocument,
  readBytes,
  savePdf,
  setting,
  setSetting,
} from "../database";
import { pdfPlacement, type Placement } from "../features/signature/placement";
import { useTheme } from "../theme";

export default function SignPdf() {
  const { id, page: initialPage } = useLocalSearchParams<{
    id: string;
    page?: string;
  }>();
  const t = useTheme();
  const { height } = useWindowDimensions();
  const [workspaceHeight, setWorkspaceHeight] = useState(height - 300);
  const [doc, setDoc] = useState<LocalDocument | null>(null);
  const [page, setPage] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [gesturing, setGesturing] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let live = true;
    setDoc(null);
    setPlacement(null);
    setError("");
    void Promise.all([
      getDocument(id),
      setting<string | null>("signature", null),
    ])
      .then(([document, saved]) => {
        if (!live) return;
        if (!document) throw new Error("This document is no longer available.");
        setDoc(document);
        setSignature(saved);
        const requested = Number(initialPage ?? 1);
        setPage(
          Math.min(
            document.pageCount - 1,
            Math.max(0, Number.isInteger(requested) ? requested - 1 : 0),
          ),
        );
      })
      .catch((e) => {
        if (live)
          setError(e instanceof Error ? e.message : "Could not open PDF.");
      });
    return () => {
      live = false;
    };
  }, [id, initialPage, attempt]);
  async function keepSignature(uri: string) {
    const target = `${FS.documentDirectory}folio-signature-${Crypto.randomUUID()}.png`;
    await FS.copyAsync({ from: uri, to: target });
    try {
      await setSetting("signature", target);
    } catch (error) {
      await FS.deleteAsync(target, { idempotent: true }).catch(() => {});
      throw error;
    }
    setSignature(target);
    setPlacement(null);
    setDrawing(false);
  }

  async function uploadSignature() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
    });
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    if ((image.fileSize ?? 0) > 15 * 1024 * 1024)
      throw new Error("Choose a signature image under 15 MB.");
    const resize =
      Math.max(image.width, image.height) > 1200
        ? [
            {
              resize:
                image.width >= image.height
                  ? { width: 1200 }
                  : { height: 1200 },
            },
          ]
        : [];
    const png = await manipulateAsync(image.uri, resize, {
      format: SaveFormat.PNG,
    });
    try {
      await keepSignature(png.uri);
    } finally {
      if (png.uri !== image.uri)
        await FS.deleteAsync(png.uri, { idempotent: true }).catch(() => {});
    }
  }
  async function save() {
    if (!doc || !signature || !placement || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const source = await readBytes(doc.uri);
      const pdfPage = (await PDFDocument.load(source)).getPage(page);
      const position = pdfPlacement(
        placement,
        pdfPage.getCropBox(),
        pdfPage.getRotation().angle,
      );
      const bytes = await editPdf(source, {
        signature: { png: await readBytes(signature), page, ...position },
      });
      const copy = await savePdf(
        `${doc.title} signed`,
        bytes,
        [],
        doc.sensitive,
      );
      router.replace({ pathname: "/document/[id]", params: { id: copy.id } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your signature is still here; try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen>
      {!doc ? (
        <View style={{ ...layout.content, gap: 16 }}>
          {error ? (
            <>
              <Label>{error}</Label>
              <Button title="Retry" onPress={() => setAttempt((v) => v + 1)} />
            </>
          ) : (
            <>
              <ActivityIndicator color={t.primary} />
              <Label>Opening PDF…</Label>
            </>
          )}
        </View>
      ) : (
        <>
          <ScrollView
            onLayout={(e) => setWorkspaceHeight(e.nativeEvent.layout.height)}
            scrollEnabled={!gesturing && !saving}
            contentContainerStyle={{ padding: 16, gap: 12 }}
          >
            <Label size={18}>{doc.title}</Label>
            <View style={{ ...layout.row, justifyContent: "space-between" }}>
              <Button
                title="Previous"
                icon="chevron-back-outline"
                secondary
                disabled={page <= 0 || saving}
                onPress={() => {
                  setPlacement(null);
                  setPage(page - 1);
                }}
              />
              <Label size={13}>
                Page {page + 1} / {doc.pageCount}
              </Label>
              <Button
                title="Next"
                icon="chevron-forward-outline"
                secondary
                disabled={page + 1 >= doc.pageCount || saving}
                onPress={() => {
                  setPlacement(null);
                  setPage(page + 1);
                }}
              />
            </View>
            <View pointerEvents={saving ? "none" : "auto"}>
              <SignaturePlacement
                key={`${doc.id}:${page}`}
                uri={doc.uri}
                page={page}
                signature={signature}
                onChange={setPlacement}
                onDrag={setGesturing}
                maxHeight={Math.max(180, workspaceHeight - 210)}
              />
            </View>
            {!signature && (
              <Label muted size={13}>
                Draw or upload a signature, then drag it onto the page.
              </Label>
            )}
            {!!error && <Label>{error}</Label>}
          </ScrollView>
          <View
            style={{
              padding: 16,
              gap: 10,
              borderTopWidth: 1,
              borderTopColor: t.line,
              backgroundColor: t.surface,
            }}
          >
            <View style={layout.row}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Draw signature"
                  icon="create-outline"
                  secondary={!!signature}
                  disabled={saving}
                  onPress={() => setDrawing(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Upload image"
                  icon="image-outline"
                  secondary
                  disabled={saving}
                  onPress={uploadSignature}
                />
              </View>
              {signature && (
                <Button
                  title="Remove"
                  icon="trash-outline"
                  secondary
                  disabled={saving}
                  onPress={() => {
                    setSignature(null);
                    setPlacement(null);
                  }}
                />
              )}
            </View>
            <Button
              title={saving ? "Saving signed copy…" : "Save signed copy"}
              icon="checkmark-outline"
              disabled={!signature || !placement || saving}
              onPress={save}
            />
            <Label muted size={11}>
              Original PDF stays unchanged. No added watermark.
            </Label>
          </View>
        </>
      )}
      <Modal
        visible={drawing}
        animationType="slide"
        onRequestClose={() => setDrawing(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: t.bg, padding: 20, gap: 20 }}
        >
          <Button
            title="Back to PDF"
            icon="close-outline"
            secondary
            onPress={() => setDrawing(false)}
          />
          <Label size={24}>Your signature</Label>
          <SignaturePad onSave={keepSignature} />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
