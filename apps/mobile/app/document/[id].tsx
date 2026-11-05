import { PDFDocument } from "pdf-lib";
import { SignaturePlacement } from "../../components/SignaturePlacement";
import {
  pdfPlacement,
  type Placement,
} from "../../features/signature/placement";
import { TranslationPanel } from "../../components/TranslationPanel";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import { Disclosure, PageHeading } from "../../components/experience";
import { useTheme } from "../../theme";
import { Screen } from "../../components/Screen";
import { rasterizePdf } from "../../native/image";
import * as Crypto from "expo-crypto";
import { useCallback, useRef, useState } from "react";
import { ScrollView, View, Alert } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import Pdf from "react-native-pdf";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as Clipboard from "expo-clipboard";
import * as FS from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari/400Regular";
import { editPdf, imagesToPdf } from "@folio/pdf";
import type { LocalDocument } from "@folio/shared-types";
import { Button, Card, Field, Label, layout } from "../../components/ui";
import { SignaturePad } from "../../components/SignaturePad";
import {
  getDocument,
  updateDocument,
  duplicateDocument,
  readBytes,
  savePdf,
  folders,
  setting,
  setSetting,
} from "../../database";
import { recognize } from "../../features/ocr";
import { keepLocalConflict } from "../../features/sync";
import { useDraft } from "../../store";
export default function DocumentScreen() {
  return (
    <Screen>
      <DocumentScreenContent />
    </Screen>
  );
}
function DocumentScreenContent() {
  const theme = useTheme();
  const { id, panel } = useLocalSearchParams<{ id: string; panel?: string }>(),
    [doc, setDoc] = useState<LocalDocument | null>(null),
    [title, setTitle] = useState(""),
    [allFolders, setFolders] = useState<{ id: string; name: string }[]>([]),
    [dragging, setDragging] = useState(false),
    [placement, setPlacement] = useState<Placement | null>(null),
    [signature, setSignature] = useState(false),
    [signatureUri, setSignatureUri] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [pageIndex, setPageIndex] = useState(1),
    [x, setX] = useState("40"),
    [y, setY] = useState("40"),
    [width, setWidth] = useState("180"),
    [angle, setAngle] = useState("0"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [ocrProgress, setOcrProgress] = useState("");
  const ocrPending = useRef(false);
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    void Promise.all([
      getDocument(id),
      folders(),
      setting<string | null>("signature", null),
    ])
      .then(([value, folderList, savedSignature]) => {
        setDoc(value);
        setTitle(value?.title ?? "");
        setFolders(folderList);
        setSignatureUri(savedSignature);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Couldn't open this document.",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);
  useFocusEffect(reload);
  async function patch(values: Parameters<typeof updateDocument>[1]) {
    const result = await updateDocument(id, values);
    setDoc(result);
  }
  if (!doc)
    return (
      <View style={layout.content}>
        <Label>
          {loading
            ? "Opening your document…"
            : error || "This document is no longer available."}
        </Label>
        {!loading && <Button title="Try again" secondary onPress={reload} />}
      </View>
    );
  const current = doc;
  async function runOcr(language: "latin" | "devanagari") {
    if (current.pageCount > 50)
      throw new Error("Split PDFs longer than 50 pages before running OCR.");
    if (ocrPending.current)
      throw new Error("Text recognition is already running.");
    ocrPending.current = true;
    setOcrProgress("Preparing document…");
    try {
      const sourcePages = [...current.pages];
      if (!sourcePages.length) {
        for (let i = 0; i < current.pageCount; i++) {
          const image = await rasterizePdf(current.uri, i);
          const uri = `${FS.documentDirectory}folio/${current.id}/ocr-${Crypto.randomUUID()}.jpg`;
          await FS.copyAsync({ from: image.uri, to: uri });
          sourcePages.push({
            id: Crypto.randomUUID(),
            ...image,
            uri,
            originalUri: uri,
            rotation: 0,
            filter: "original",
          });
        }
      }
      const pages = [];
      for (const [i, page] of sourcePages.entries()) {
        setOcrProgress(`Reading page ${i + 1} of ${sourcePages.length}…`);
        pages.push(await recognize(page, language));
      }
      const text = pages.map((p) => p.text ?? "").join("\n\n");
      await patch({ pages, text });
      if (!text.trim())
        Alert.alert(
          "No text found",
          "Choose the correct language and try a sharper scan. Original or Clean color often works best.",
        );
      return text;
    } finally {
      ocrPending.current = false;
      setOcrProgress("");
    }
  }
  async function searchable() {
    if (!current.pages.length || !current.pages.every((p) => p.words?.length))
      throw new Error(
        "Run OCR on every page before creating a searchable PDF.",
      );
    const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error("Search font is unavailable.");
    const pages = [];
    for (const p of current.pages)
      pages.push({
        bytes: await readBytes(p.uri),
        type: "jpg" as const,
        words: p.words,
        width: p.width,
        height: p.height,
      });
    const bytes = await imagesToPdf(pages, {
      font: await readBytes(asset.localUri),
      idLayout: current.sensitive ? "vertical" : undefined,
    });
    const copy = await savePdf(
      `${current.title} searchable`,
      bytes,
      current.pages,
      current.sensitive,
    );
    router.push({ pathname: "/document/[id]", params: { id: copy.id } });
  }
  async function annotation(kind: "signature" | "note") {
    const px = Number(x),
      py = Number(y),
      w = Number(width),
      rotation = Number(angle);
    if (
      ![px, py, w, rotation].every(Number.isFinite) ||
      px < 0 ||
      py < 0 ||
      w < 10 ||
      w > 1000
    )
      throw new Error("Enter valid placement coordinates.");
    const source = await readBytes(current.uri);
    const selectedPage = (await PDFDocument.load(source)).getPage(
      pageIndex - 1,
    );
    const visualPlacement = placement
      ? pdfPlacement(
          placement,
          selectedPage.getCropBox(),
          selectedPage.getRotation().angle,
        )
      : null;
    if (kind === "signature" && !visualPlacement)
      throw new Error("Wait for the signature preview to load.");
    const bytes = await editPdf(
      source,
      kind === "signature"
        ? {
            signature: {
              png: await readBytes(signatureUri!),
              page: pageIndex - 1,
              x: px,
              y: py,
              width: w,
              height: w / 2.5,
              rotation,
              ...visualPlacement,
            },
          }
        : { notes: [{ page: pageIndex - 1, text: note, x: px, y: py }] },
    );
    const copy = await savePdf(
      `${current.title} annotated`,
      bytes,
      [],
      current.sensitive,
    );
    router.push({ pathname: "/document/[id]", params: { id: copy.id } });
  }
  return (
    <ScrollView
      scrollEnabled={!dragging}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={layout.content}
    >
      <PageHeading
        title={doc.title}
        subtitle={`${doc.pageCount} pages · ${(doc.fileSize / 1048576).toFixed(2)} MB · ${doc.sensitive ? "Private document" : "Saved on device"}`}
      />
      <Disclosure
        title="Document name"
        icon="pencil-outline"
        description="Rename this file"
      >
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Document title"
        />
        <Button
          title="Rename"
          secondary
          disabled={!title.trim() || title === doc.title}
          onPress={() => patch({ title: title.trim() })}
        />
      </Disclosure>
      <Pdf
        source={{ uri: doc.uri, cache: false }}
        style={{
          height: 440,
          width: "100%",
          backgroundColor: theme.tint,
          borderRadius: 16,
        }}
        onPageChanged={(p) => {
          if (p !== pageIndex) {
            setPlacement(null);
            setPageIndex(p);
          }
        }}
        onError={(e) => setError(String(e))}
        trustAllCerts={false}
        enablePaging
      />
      {error && <Label>{error}</Label>}
      <Label muted size={12}>
        Page {pageIndex} of {doc.pageCount} · Pinch to zoom, swipe to navigate
      </Label>
      <View style={layout.wrap}>
        <Button
          title="Share PDF"
          compact
          icon="share-outline"
          onPress={() =>
            Sharing.shareAsync(doc.uri, { mimeType: "application/pdf" })
          }
        />
        <Button
          title="Print"
          compact
          icon="print-outline"
          secondary
          onPress={() => Print.printAsync({ uri: doc.uri })}
        />
        <Button
          title={doc.favorite ? "Unfavorite" : "Favorite"}
          compact
          icon={doc.favorite ? "star" : "star-outline"}
          secondary
          onPress={() => patch({ favorite: !doc.favorite })}
        />
        <Button
          title="Duplicate"
          compact
          icon="copy-outline"
          secondary
          onPress={async () => {
            const copy = await duplicateDocument(doc);
            router.push({
              pathname: "/document/[id]",
              params: { id: copy.id },
            });
          }}
        />
        {
          <Button
            title="Filters & crop pages"
            compact
            icon="color-filter-outline"
            secondary
            onPress={async () => {
              if (!(await confirmReplaceDraft())) return;
              const { pdfToScanPages } = await import("../../features/pdf");
              const pages = doc.pages.length
                ? doc.pages
                : await pdfToScanPages(doc.uri);
              useDraft.getState().clear();
              useDraft.getState().setIdMode(doc.sensitive);
              useDraft.getState().set(pages);
              router.push("/editor");
            }}
          />
        }
      </View>
      <Disclosure
        title="Folder"
        icon="folder-outline"
        description="Choose where this document belongs"
      >
        <View style={layout.wrap}>
          <Button
            title="Unfiled"
            secondary
            onPress={() => patch({ folderId: null })}
          />
          {allFolders.map((f) => (
            <Button
              key={f.id}
              title={`${doc.folderId === f.id ? "✓ " : ""}${f.name}`}
              secondary
              onPress={() => patch({ folderId: f.id })}
            />
          ))}
        </View>
      </Disclosure>
      <Disclosure
        initiallyOpen={
          panel === "ocr" || panel === "translate" || panel === "markdown"
        }
        title="Text recognition"
        icon="scan-outline"
        description="Read, copy or create a searchable PDF"
      >
        <View style={layout.wrap}>
          <Button
            secondary
            title="Read English"
            icon="scan-outline"
            disabled={!!ocrProgress}
            onPress={() => runOcr("latin")}
          />
          <Button
            secondary
            title="Read Hindi"
            icon="scan-outline"
            disabled={!!ocrProgress}
            onPress={() => runOcr("devanagari")}
          />
        </View>
        {!!ocrProgress && <Label muted>{ocrProgress}</Label>}
        <Label muted size={12}>
          OCR extracts the words in your document. To change the language, use
          Translate document below.
        </Label>
        {doc.text ? (
          <>
            <Label>{doc.text}</Label>
            <View style={layout.wrap}>
              <Button
                title="Copy text"
                secondary
                onPress={() => Clipboard.setStringAsync(doc.text)}
              />
              <Button
                title="Export TXT"
                secondary
                onPress={async () => {
                  const uri = `${FS.cacheDirectory}${doc.id}.txt`;
                  await FS.writeAsStringAsync(uri, doc.text);
                  await Sharing.shareAsync(uri, { mimeType: "text/plain" });
                }}
              />
              <Button title="Searchable PDF" secondary onPress={searchable} />
            </View>
          </>
        ) : (
          <Label muted>
            No recognized text yet. OCR results may contain errors; check
            important details against the source.
          </Label>
        )}
      </Disclosure>
      <Disclosure
        initiallyOpen={panel === "markdown"}
        title="PDF to Markdown"
        icon="logo-markdown"
        description="Export recognized text with page headings"
      >
        <Label muted size={12}>
          Run English or Hindi text recognition above first. This exports text
          in page order; tables and original layout are not reconstructed.
        </Label>
        <Button
          title="Export Markdown"
          icon="logo-markdown"
          disabled={!doc.text.trim()}
          onPress={async () => {
            const { documentMarkdown } =
              await import("../../features/pdf/markdown");
            const markdown = documentMarkdown(
              doc.title,
              doc.pages.map((p) => p.text ?? ""),
              doc.text,
            );
            const uri = `${FS.cacheDirectory}${doc.id}.md`;
            await FS.writeAsStringAsync(uri, markdown);
            await Sharing.shareAsync(uri, {
              mimeType: "text/markdown",
              UTI: "net.daringfireball.markdown",
            });
          }}
        />
      </Disclosure>
      <Disclosure
        initiallyOpen={panel === "translate"}
        title="Translate document"
        icon="language-outline"
        description="English ↔ Hindi · copy, TXT and translated PDF"
      >
        <TranslationPanel
          text={doc.text}
          id={doc.id}
          title={doc.title}
          sensitive={doc.sensitive}
          onRecognize={(language) =>
            runOcr(language === "hi" ? "devanagari" : "latin")
          }
        />
      </Disclosure>
      <Disclosure
        initiallyOpen={panel === "sign"}
        title="Signature & notes"
        icon="create-outline"
        description="Sign your PDF or add a text note"
      >
        <Button
          title={signature ? "Close drawing pad" : "Draw a signature"}
          secondary
          onPress={() => setSignature(!signature)}
        />
        {signature && (
          <SignaturePad
            onDrawing={setDragging}
            onSave={async (uri) => {
              const target = `${FS.documentDirectory}folio-signature-${Crypto.randomUUID()}.png`;
              await FS.copyAsync({ from: uri, to: target });
              await setSetting("signature", target);
              setSignatureUri(target);
              setSignature(false);
            }}
          />
        )}
        {signatureUri && (
          <SignaturePlacement
            key={`${doc.id}:${pageIndex}:${signatureUri}`}
            uri={doc.uri}
            page={pageIndex - 1}
            signature={signatureUri}
            onChange={setPlacement}
            onDrag={setDragging}
          />
        )}
        <Button
          title="Save signed PDF"
          icon="checkmark-outline"
          disabled={!signatureUri || !placement}
          onPress={() => annotation("signature")}
        />
        <Disclosure
          title="Text note placement"
          icon="text-outline"
          description="Optional PDF coordinates and note"
        >
          <Label muted size={12}>
            Placement uses PDF points from the bottom-left of page {pageIndex}.
            Save as a new copy and review placement before sharing.
          </Label>
          <View style={layout.row}>
            <View style={{ flex: 1 }}>
              <Field value={x} onChangeText={setX} placeholder="X" />
            </View>
            <View style={{ flex: 1 }}>
              <Field value={y} onChangeText={setY} placeholder="Y" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                value={width}
                onChangeText={setWidth}
                placeholder="Width"
              />
            </View>
          </View>
          <Field
            value={angle}
            onChangeText={setAngle}
            placeholder="Signature rotation (degrees)"
          />
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Text annotation"
            multiline
          />
          <Button
            title="Add text as new copy"
            secondary
            disabled={!note}
            onPress={() => annotation("note")}
          />
        </Disclosure>
      </Disclosure>
      {doc.syncState === "conflict" && (
        <Card>
          <Label>A cloud version changed.</Label>
          <Label muted>
            Duplicate this local copy before resolving if you want to preserve
            both versions.
          </Label>
          <Button
            title="Keep local version on next sync"
            onPress={async () => {
              await keepLocalConflict(doc);
              reload();
            }}
          />
        </Card>
      )}
      <Button
        title={doc.deletedAt ? "Restore from trash" : "Move to trash"}
        secondary
        onPress={() =>
          Alert.alert(
            doc.deletedAt ? "Restore document?" : "Move to trash?",
            doc.deletedAt
              ? "The document will reappear in your library."
              : "You can restore it later from Trash.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: doc.deletedAt ? "Restore" : "Move to trash",
                onPress: () => {
                  void patch({
                    deletedAt: doc.deletedAt ? null : new Date().toISOString(),
                  }).catch((e) => Alert.alert("Could not update", String(e)));
                },
              },
            ],
          )
        }
      />
      <Label muted size={11}>
        Created {new Date(doc.createdAt).toLocaleString()}
        {doc.sensitive ? " · Excluded from cloud backup" : ""}
      </Label>
    </ScrollView>
  );
}
