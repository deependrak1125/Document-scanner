import { useDraft } from "../../store";
import { importImages } from "../../features/scanner";
import { confirmReplaceDraft } from "../../features/scanner/draft";
import { rasterizePdf } from "../../native/image";
import { useState } from "react";
import { ScrollView, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
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
import {
  SectionHeading,
  PageHeading,
  Chip,
  Notice,
  ActionCard,
} from "../../components/experience";
export default function Tools() {
  const user = useAuth((s) => s.user);
  const t = useTheme(),
    [file, setFile] = useState<{ uri: string; name: string } | null>(null),
    [selection, setSelection] = useState("1"),
    [watermark, setWatermark] = useState("CONFIDENTIAL"),
    [password, setPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [catalog, setCatalog] = useState(true),
    [toolQuery, setToolQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [progress, setProgress] = useState(""),
    [deletingPages, setDeletingPages] = useState(false),
    [section, setSection] = useState<"pages" | "watermark" | "cloud">("pages");
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
    router.push({ pathname: "/document/[id]", params: { id: doc.id, panel } });
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
  const tools = [
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
        if (!chosen) return;
        try {
          open(
            (await compressPdfLocally(chosen.uri, chosen.name, setProgress)).id,
          );
        } finally {
          setProgress("");
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
  const categories: Record<string, string[]> = {
    Organize: [
      "Merge PDF",
      "Split / extract pages",
      "Remove pages",
      "Organize pages",
    ],
    Convert: [
      "Office to PDF",
      "JPG to PDF",
      "PDF to JPG",
      "Scan to PDF",
      "PDF to Markdown",
    ],
    Enhance: ["Compress PDF", "PDF filters", "Crop PDF"],
    Edit: [
      "Fill PDF forms",
      "Compare PDFs",
      "Rotate PDF",
      "Page numbers",
      "Watermark PDF",
      "Sign / annotate PDF",
    ],
    Text: ["OCR / searchable PDF", "Translate document", "Extract text"],
    Security: ["Protect / unlock PDF"],
  };
  const matches = (tool: (typeof tools)[number]) =>
    `${tool.title} ${tool.description}`
      .toLowerCase()
      .includes(toolQuery.toLowerCase());
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layout.content}
      >
        {catalog ? (
          <>
            <PageHeading
              eyebrow="All PDF tools"
              title="PDF workspace"
              subtitle="Choose a tool. Pick your file. Save a new copy."
            />
            <Field
              value={toolQuery}
              onChangeText={setToolQuery}
              placeholder="Search tools…"
            />
            {!!progress && <Notice message={progress} />}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {["All", ...Object.keys(categories)].map((name) => (
                <Chip
                  key={name}
                  title={name}
                  selected={category === name}
                  onPress={() => setCategory(name)}
                />
              ))}
            </ScrollView>
            {Object.entries(categories)
              .filter(([name]) => category === "All" || category === name)
              .map(([name, titles]) => {
                const items = tools.filter(
                  (tool) => titles.includes(tool.title) && matches(tool),
                );
                return items.length ? (
                  <View key={name} style={{ gap: 12 }}>
                    <SectionHeading
                      title={name}
                      icon={
                        name === "Organize"
                          ? "layers-outline"
                          : name === "Convert"
                            ? "swap-horizontal-outline"
                            : name === "Enhance"
                              ? "sparkles-outline"
                              : name === "Edit"
                                ? "create-outline"
                                : name === "Security"
                                  ? "shield-checkmark-outline"
                                  : "text-outline"
                      }
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {items.map((tool) => (
                        <ActionCard key={tool.title} {...tool} tile />
                      ))}
                    </View>
                  </View>
                ) : null;
              })}
            {!tools.some(
              (tool) =>
                matches(tool) &&
                (category === "All" ||
                  categories[category]?.includes(tool.title)),
            ) && (
              <Notice message="No matching tools. Try PDF, translate, crop or merge." />
            )}
          </>
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
              onPress={async () => {
                const files = await selectPdfs();
                if (files[0]) {
                  setFile(files[0]);
                  setConsent(false);
                }
              }}
            />
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
              <Chip
                title="Cloud tools"
                icon="cloud-outline"
                selected={section === "cloud"}
                onPress={() => setSection("cloud")}
              />
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
            {section === "watermark" && (
              <Card>
                <Label size={19}>Make it yours</Label>
                <Field
                  value={watermark}
                  onChangeText={setWatermark}
                  placeholder="Watermark text"
                />
                <Button
                  title="Add watermark"
                  secondary
                  disabled={!file || !watermark}
                  onPress={() => edit({ watermark })}
                />
              </Card>
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
