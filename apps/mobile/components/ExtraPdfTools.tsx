import { useState } from "react";
import { Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari/400Regular";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import * as FS from "expo-file-system/legacy";
import { PDFDocument } from "pdf-lib";
import { textToPdf } from "@folio/pdf";
import { readBytes, savePdf } from "../database";
import { rasterizePdf } from "../native/image";
import { useTheme } from "../theme";
import { Button, Field, Label, layout } from "./ui";

export type ExtraPdfTool = "Text to PDF" | "Edit PDF metadata" | "PDF to PNG";
type SelectedPdf = { uri: string; name: string };

export function ExtraPdfTools({
  tool,
  file,
  onClose,
  onSaved,
}: {
  tool: ExtraPdfTool;
  file?: SelectedPdf;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(
    tool === "Text to PDF" ? "Text document" : "",
  );
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [page, setPage] = useState("1");
  async function run() {
    setBusy(true);
    try {
      if (tool === "Text to PDF") {
        const asset = Asset.fromModule(NotoSansDevanagari_400Regular);
        await asset.downloadAsync();
        if (!asset.localUri)
          throw new Error("The document font could not be loaded.");
        const doc = await savePdf(
          title.trim() || "Text document",
          await textToPdf(body, await readBytes(asset.localUri)),
        );
        onSaved(doc.id);
        return;
      }
      if (!file) return;
      const pdf = await PDFDocument.load(await readBytes(file.uri));
      if (tool === "Edit PDF metadata") {
        if (title.trim()) pdf.setTitle(title.trim());
        if (author.trim()) pdf.setAuthor(author.trim());
        if (subject.trim()) pdf.setSubject(subject.trim());
        const doc = await savePdf(
          file.name.replace(/\.pdf$/i, "") + " metadata",
          await pdf.save(),
        );
        onSaved(doc.id);
        return;
      }
      const number = Number(page);
      if (
        !Number.isInteger(number) ||
        number < 1 ||
        number > pdf.getPageCount()
      )
        throw new Error(`Enter a page number from 1 to ${pdf.getPageCount()}.`);
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");
      const rendered = await rasterizePdf(file.uri, number - 1);
      try {
        const png = await manipulateAsync(rendered.uri, [], {
          format: SaveFormat.PNG,
        });
        await Sharing.shareAsync(png.uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: "Save or share PNG",
        });
      } finally {
        await FS.deleteAsync(rendered.uri, { idempotent: true }).catch(
          () => {},
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView
          contentContainerStyle={layout.content}
          keyboardShouldPersistTaps="handled"
        >
          <Button
            title="Close"
            secondary
            icon="close-outline"
            disabled={busy}
            onPress={onClose}
          />
          <Label size={26}>{tool}</Label>
          {file && <Label muted>{file.name}</Label>}
          {tool === "Text to PDF" && (
            <>
              <Field
                value={title}
                onChangeText={setTitle}
                placeholder="Document name"
              />
              <Field
                value={body}
                onChangeText={setBody}
                placeholder="Type or paste your text"
                multiline
              />
            </>
          )}
          {tool === "Edit PDF metadata" && (
            <>
              <Label muted>
                Blank fields leave existing metadata as it is.
              </Label>
              <Field
                value={title}
                onChangeText={setTitle}
                placeholder="PDF title"
              />
              <Field
                value={author}
                onChangeText={setAuthor}
                placeholder="Author"
              />
              <Field
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject"
              />
            </>
          )}
          {tool === "PDF to PNG" && (
            <Field
              value={page}
              onChangeText={setPage}
              placeholder="Page number"
              keyboardType="number-pad"
            />
          )}
          <Button
            title={
              tool === "PDF to PNG" ? "Save or share PNG" : "Save PDF copy"
            }
            disabled={
              busy ||
              (tool === "Text to PDF" && !body.trim()) ||
              (tool === "Edit PDF metadata" &&
                ![title, author, subject].some((value) => value.trim()))
            }
            icon="checkmark-outline"
            onPress={run}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
