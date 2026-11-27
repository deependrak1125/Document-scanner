import { folioServerEnabled } from "../../features/auth/serverMode";
import {
  ExtraPdfTools,
  type ExtraPdfTool,
} from "../../components/ExtraPdfTools";
import { PdfWorkspaceCatalog } from "../../components/PdfWorkspaceCatalog";
import { FillGradient } from "../../components/HomeArtwork";
import { WatermarkEditor } from "../../components/WatermarkEditor";
import { PdfFilePreview } from "../../components/PdfFilePreview";
import { useDraft } from "../../store";
import { importImages } from "../../features/scanner";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import { rasterizePdf } from "../../native/image";
import { useEffect, useState } from "react";
import { ScrollView, View, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import { Button, Field, Label, Card, layout } from "../../components/ui";
import {
  selectPdfs,
  editFile,
  selectPages,
  removePages,
  pdfToScanPages,
  compressPdfLocally,
} from "../../features/pdf";
import { api, authorized, useAuth } from "../../features/auth";
import { readBytes, savePdf } from "../../database";
import { useTheme } from "../../theme";
import { PageHeading, Chip, Notice } from "../../components/experience";
export default function Tools() {
  const [extraTool, setExtraTool] = useState<{
    tool: ExtraPdfTool;
    file?: { uri: string; name: string };
  } | null>(null);
  const [compressFile, setCompressFile] = useState<{
    name: string;
    uri: string;
  } | null>(null);
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState<"KB" | "MB">("KB");
  const { tool: shortcut } = useLocalSearchParams<{ tool?: string }>();
  const user = useAuth((s) => s.user);
  const t = useTheme(),
    [file, setFile] = useState<{ uri: string; name: string } | null>(null),
    [selection, setSelection] = useState("1"),
    [draggingStamp, setDraggingStamp] = useState(false),
    [password, setPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [catalog, setCatalog] = useState(true),
    [progress, setProgress] = useState(""),
    [deletingPages, setDeletingPages] = useState(false),
    [section, setSection] = useState<"pages" | "watermark" | "cloud">("pages");
  useEffect(() => {
    if (shortcut) setCatalog(true);
  }, [shortcut]);
  const open = (id: string) =>
    router.push({ pathname: "/document/[id]", params: { id } });
  async function chooseFile() {
    const files = await selectPdfs();
    if (!files[0]) return null;
    setFile(files[0]);
    setConsent(false);
    return files[0];
  }
  async function documentTool(
    panel: "ocr" | "translate" | "sign" | "markdown",
  ) {
    const chosen = await chooseFile();
    if (!chosen) return;
    const doc = await savePdf(
      chosen.name.replace(/\.pdf$/i, ""),
      await readBytes(chosen.uri),
    );
    router.push({
      pathname: panel === "sign" ? "/sign" : "/document/[id]",
      params: { id: doc.id, panel },
    });
  }
  async function imageEditor() {
    if (!(await confirmReplaceDraft())) return;
    const chosen = await chooseFile();
    if (!chosen) return;
    try {
      const pages = await pdfToScanPages(chosen.uri, setProgress);
      useDraft.getState().clear();
      useDraft.getState().add(pages);
      router.push("/editor");
    } finally {
      setProgress("");
    }
  }
  function workspace(next: "pages" | "watermark" | "cloud", remove = false) {
    setSection(next);
    setDeletingPages(remove);
    setCatalog(false);
  }
  async function openExtraTool(tool: ExtraPdfTool) {
    if (tool === "Text to PDF") {
      setExtraTool({ tool });
      return;
    }
    const [selected] = await selectPdfs();
    if (selected) setExtraTool({ tool, file: selected });
  }
  const tools = [
    {
      title: "Text to PDF",
      description: "Create a PDF from typed or pasted text",
      icon: "document-text-outline" as const,
      onPress: () => openExtraTool("Text to PDF"),
    },
    {
      title: "PDF to PNG",
      description: "Save a selected page as a PNG image",
      icon: "image-outline" as const,
      onPress: () => openExtraTool("PDF to PNG"),
    },
    {
      title: "Edit PDF metadata",
      description: "Change the PDF title, author, or subject",
      icon: "information-circle-outline" as const,
      onPress: () => openExtraTool("Edit PDF metadata"),
    },
    {
      title: "Office to PDF",
      description: "DOCX, XLSX and PPTX · server conversion",
      icon: "document-attach-outline" as const,
      onPress: () => router.push("/office"),
    },
    {
      title: "Fill PDF forms",
      description: "Fill existing text fields, checkboxes and choices",
      icon: "checkbox-outline" as const,
      onPress: () => router.push("/forms"),
    },
    {
      title: "Compare PDFs",
      description: "Compare two versions visually on your device",
      icon: "git-compare-outline" as const,
      onPress: () => router.push("/compare"),
    },
    {
      title: "PDF to Markdown",
      description: "Recognize text and export an editable .md file",
      icon: "logo-markdown" as const,
      onPress: () => documentTool("markdown"),
    },
    {
      title: "Merge PDF",
      description: "Combine multiple PDFs into one file",
      icon: "layers-outline" as const,
      onPress: () => router.push("/merge"),
    },
    {
      title: "Split / extract pages",
      description: "Save selected pages as a new PDF",
      icon: "cut-outline" as const,
      onPress: () => workspace("pages"),
    },
    {
      title: "Remove pages",
      description: "Choose the pages to delete",
      icon: "trash-outline" as const,
      onPress: () => workspace("pages", true),
    },
    {
      title: "Organize pages",
      description: "Set a new page order, e.g. 3,1,2",
      icon: "swap-vertical" as const,
      onPress: () => workspace("pages"),
    },
    {
      title: "Compress PDF",
      description:
        "Offline image compression · removes selectable text and forms",
      icon: "contract-outline" as const,
      onPress: async () => {
        const chosen = await chooseFile();
        if (chosen) {
          setTarget("");
          setCompressFile(chosen);
        }
      },
    },
    {
      title: "PDF filters",
      description:
        "White paper, colored ink, grayscale and more · creates an image PDF",
      icon: "color-filter-outline" as const,
      onPress: imageEditor,
    },
    {
      title: "Crop PDF",
      description: "Adjust each page in the image editor",
      icon: "crop-outline" as const,
      onPress: imageEditor,
    },
    {
      title: "JPG to PDF",
      description: "Combine your photos into a PDF",
      icon: "images-outline" as const,
      onPress: async () => {
        if (!(await confirmReplaceDraft())) return;
        const pages = await importImages();
        if (pages.length) {
          useDraft.getState().clear();
          useDraft.getState().add(pages);
          router.push("/editor");
        }
      },
    },
    {
      title: "PDF to JPG",
      description: "Choose and export a page as an image",
      icon: "image-outline" as const,
      onPress: () => {
        workspace("pages");
      },
    },
    {
      title: "Rotate PDF",
      description: "Rotate every page 90°",
      icon: "refresh-outline" as const,
      onPress: async () => {
        const chosen = await chooseFile();
        if (chosen)
          open(
            (
              await editFile(chosen.uri, `${chosen.name} rotated`, {
                rotation: 90,
              })
            ).id,
          );
      },
    },
    {
      title: "Page numbers",
      description: "Number the pages in your PDF",
      icon: "list-outline" as const,
      onPress: async () => {
        const chosen = await chooseFile();
        if (chosen)
          open(
            (
              await editFile(chosen.uri, `${chosen.name} numbered`, {
                pageNumbers: true,
              })
            ).id,
          );
      },
    },
    {
      title: "Watermark PDF",
      description: "Stamp text onto every page",
      icon: "water-outline" as const,
      onPress: () => workspace("watermark"),
    },
    {
      title: "OCR / searchable PDF",
      description: "Recognize English or Hindi on your device",
      icon: "scan-outline" as const,
      onPress: () => documentTool("ocr"),
    },
    {
      title: "Translate document",
      description: "English ↔ Hindi · copy and export translated text",
      icon: "language-outline" as const,
      onPress: () => documentTool("translate"),
    },
    {
      title: "Sign / annotate PDF",
      description: "Draw a signature or add text notes",
      icon: "create-outline" as const,
      onPress: () => documentTool("sign"),
    },
    {
      title: "Protect / unlock PDF",
      description: "Password tools · requires configured cloud service",
      icon: "lock-closed-outline" as const,
      onPress: () => workspace("cloud"),
    },
    {
      title: "Extract text",
      description: "Read text with OCR, then copy or export TXT",
      icon: "text-outline" as const,
      onPress: () => documentTool("ocr"),
    },
    {
      title: "Scan to PDF",
      description: "Capture documents with your camera",
      icon: "camera-outline" as const,
      onPress: () => router.push("/scan"),
    },
  ];
  async function edit(options: Parameters<typeof editFile>[2]) {
    if (!file) throw new Error("Choose a PDF first.");
    const doc = await editFile(
      file.uri,
      `${file.name.replace(/\.pdf$/i, "")} edited`,
      options,
    );
    open(doc.id);
  }
  async function cloud(
    operation: "compress" | "encrypt" | "decrypt" | "text" | "image",
  ) {
    if (!file) throw new Error("Choose a PDF first.");
    if (!consent) throw new Error("Confirm cloud processing consent first.");
    await authorized(() => api.request("/auth/me"));
    const response = await expoFetch(`${api.baseUrl}/api/v1/pdf/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${useAuth.getState().token}`,
        "Content-Type": "application/pdf",
        "X-Folio-Consent": "upload-for-processing",
        "X-Folio-Options": JSON.stringify({
          operation,
          ...(password ? { password } : {}),
          page: Number(selection) || 1,
        }),
      },
      body: new File(file.uri),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: { message: string } };
      throw new Error(data.error?.message ?? "Cloud processing failed.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      operation === "text" ||
      operation === "image" ||
      operation === "encrypt"
    ) {
      const output = new File(
        Paths.cache,
        `folio-${Crypto.randomUUID()}.${operation === "text" ? "txt" : operation === "image" ? "png" : "pdf"}`,
      );
      output.write(bytes);
      await Sharing.shareAsync(output.uri, {
        mimeType:
          operation === "text"
            ? "text/plain"
            : operation === "image"
              ? "image/png"
              : "application/pdf",
      });
    } else open((await savePdf(`${file.name} ${operation}`, bytes)).id);
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {catalog && !t.dark && <FillGradient colors={["#eaf2ff", "#f6f8fc"]} />}
      {extraTool && (
        <ExtraPdfTools
          tool={extraTool.tool}
          file={extraTool.file}
          onClose={() => setExtraTool(null)}
          onSaved={(id) => {
            setExtraTool(null);
            open(id);
          }}
        />
      )}
      <Modal
        visible={!!compressFile}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!progress) setCompressFile(null);
        }}
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
            <Label size={21}>Compress PDF</Label>
            <Label muted>
              Enter a maximum size or leave it blank for automatic compression.
              Output is an image PDF.
            </Label>
            <Field
              value={target}
              onChangeText={setTarget}
              placeholder="Maximum size"
              keyboardType="decimal-pad"
            />
            <View style={layout.wrap}>
              {(["KB", "MB"] as const).map((value) => (
                <Chip
                  key={value}
                  title={value}
                  selected={unit === value}
                  onPress={() => setUnit(value)}
                />
              ))}
            </View>
            {!!progress && <Label>{progress}</Label>}
            <Button
              title="Compress & save"
              disabled={!!progress}
              onPress={async () => {
                if (!compressFile) return;
                const size = target.trim()
                  ? Math.floor(
                      Number(target.replace(",", ".")) *
                        (unit === "MB" ? 1048576 : 1024),
                    )
                  : undefined;
                setProgress("Preparing PDF…");
                try {
                  const doc = await compressPdfLocally(
                    compressFile.uri,
                    compressFile.name,
                    setProgress,
                    size,
                  );
                  setCompressFile(null);
                  open(doc.id);
                } finally {
                  setProgress("");
                }
              }}
            />
            <Button
              title="Cancel"
              secondary
              disabled={!!progress}
              onPress={() => setCompressFile(null)}
            />
          </Card>
        </View>
      </Modal>
      <ScrollView
        scrollEnabled={!draggingStamp}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          catalog
            ? [layout.content, { paddingHorizontal: 15, paddingTop: 12 }]
            : layout.content
        }
      >
        {catalog ? (
          <PdfWorkspaceCatalog
            tools={tools}
            shortcut={shortcut}
            clearShortcut={() => router.setParams({ tool: undefined })}
            progress={progress}
          />
        ) : (
          <>
            <Button
              title="All PDF tools"
              icon="arrow-back"
              secondary
              onPress={() => setCatalog(true)}
            />
            <PageHeading
              eyebrow="Made for your PDFs"
              title="A little polish."
              subtitle="Merge, organize and finish your documents."
            />
            <Notice message="Offline tools save a new copy, so your original stays safe." />
            <Button
              title="Merge multiple PDFs"
              icon="layers-outline"
              onPress={() => router.push("/merge")}
            />
            <Button
              title={file ? `Selected: ${file.name}` : "Choose PDF to edit"}
              secondary
              onPress={chooseFile}
            />
            {file && section !== "watermark" && (
              <PdfFilePreview key={file.uri} uri={file.uri} />
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={layout.row}
            >
              <Chip
                title="Pages"
                icon="documents-outline"
                selected={section === "pages"}
                onPress={() => setSection("pages")}
              />
              <Chip
                title="Watermark"
                icon="water-outline"
                selected={section === "watermark"}
                onPress={() => setSection("watermark")}
              />
              {folioServerEnabled && (
                <Chip
                  title="Cloud tools"
                  icon="cloud-outline"
                  selected={section === "cloud"}
                  onPress={() => setSection("cloud")}
                />
              )}
            </ScrollView>
            {!file && (
              <Notice message="Choose a PDF above to unlock the editing tools." />
            )}
            {section === "pages" && (
              <Card>
                <Label size={19}>Organize pages</Label>
                <Field
                  value={selection}
                  onChangeText={setSelection}
                  placeholder="Page order or ranges, e.g. 3,1-2"
                />
                <Button
                  title={
                    deletingPages
                      ? "Remove selected pages"
                      : "Extract / reorder selected pages"
                  }
                  secondary
                  disabled={!file}
                  onPress={async () =>
                    edit({
                      order: await (deletingPages ? removePages : selectPages)(
                        file!.uri,
                        selection,
                      ),
                    })
                  }
                />
                <Button
                  title="Export selected page as JPG"
                  secondary
                  disabled={!file}
                  onPress={async () => {
                    const indexes = await selectPages(file!.uri, selection);
                    if (indexes.length !== 1)
                      throw new Error("Enter one page number for JPG export.");
                    const image = await rasterizePdf(file!.uri, indexes[0]);
                    await Sharing.shareAsync(image.uri, {
                      mimeType: "image/jpeg",
                    });
                  }}
                />
                <Label muted size={12}>
                  {deletingPages
                    ? "Select the page numbers to remove. Keep at least one page."
                    : "Enter pages in the order you want. For example, 3,1-2 saves page 3 first, then pages 1 and 2."}
                </Label>
                <View style={layout.wrap}>
                  <Button
                    title="Rotate 90°"
                    secondary
                    disabled={!file}
                    onPress={() => edit({ rotation: 90 })}
                  />
                  <Button
                    title="Add page numbers"
                    secondary
                    disabled={!file}
                    onPress={() => edit({ pageNumbers: true })}
                  />
                </View>
              </Card>
            )}
            {section === "watermark" && file && (
              <WatermarkEditor
                key={file.uri}
                file={file}
                onSaved={open}
                onDrag={setDraggingStamp}
              />
            )}
            {section === "cloud" && (
              <Card>
                <Label size={19}>Cloud processing</Label>
                {!user && (
                  <Button
                    title="Sign in to use cloud tools"
                    onPress={() => router.push("/login")}
                  />
                )}
                <Label muted>
                  These tools send the selected PDF to your signed-in server for
                  temporary processing. Files are removed after processing. Do
                  not select an identity document unless you intend to upload
                  it.
                </Label>
                <Button
                  secondary
                  disabled={!file || !user}
                  title={
                    consent
                      ? "Upload consent enabled"
                      : "Review & allow this upload"
                  }
                  onPress={() =>
                    Alert.alert(
                      "Send selected PDF to the cloud?",
                      "The server will process the complete file. This is separate from cloud backup.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Allow processing",
                          onPress: () => setConsent(true),
                        },
                      ],
                    )
                  }
                />
                <Field
                  value={password}
                  onChangeText={setPassword}
                  placeholder="PDF password (protect / unlock)"
                  secureTextEntry
                />
                <View style={layout.wrap}>
                  {(
                    ["compress", "encrypt", "decrypt", "text", "image"] as const
                  ).map((operation) => (
                    <Button
                      key={operation}
                      secondary
                      title={
                        {
                          compress: "Compress",
                          encrypt: "Protect with password",
                          decrypt: "Unlock with password",
                          text: "Extract text",
                          image: "Export page as image",
                        }[operation]
                      }
                      disabled={
                        !file ||
                        !consent ||
                        !user ||
                        ((operation === "encrypt" || operation === "decrypt") &&
                          !password)
                      }
                      onPress={() => cloud(operation)}
                    />
                  ))}
                </View>
                <Label muted size={11}>
                  Requires an internet connection and a configured processing
                  service. Image export uses the page number entered in Pages.
                  Compression results depend on the source PDF. Text extraction
                  reads existing text; it does not perform OCR.
                </Label>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
