import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fromByteArray } from "base64-js";
import { readBytes } from "../../database";

export function pdfFilename(title: string) {
  // Remove control characters and filename separators supplied in document titles.
  /* eslint-disable no-control-regex */
  const name = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .trim()
    .replace(/\.pdf$/i, "")
    .trim();
  /* eslint-enable no-control-regex */
  return `${name || "Document"}.pdf`;
}

/** Export a copy; library files stay untouched, including when the picker is cancelled. */
export async function exportPdf(doc: {
  uri: string;
  title: string;
}): Promise<"saved" | "cancelled" | "shared"> {
  if (Platform.OS !== "android") {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is unavailable on this device.");
    await Sharing.shareAsync(doc.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Save PDF to Files",
    });
    return "shared";
  }
  const permission =
    await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return "cancelled";
  const bytes = await readBytes(doc.uri);
  let destination: string | undefined;
  try {
    destination = await FS.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      pdfFilename(doc.title),
      "application/pdf",
    );
    await FS.writeAsStringAsync(destination, fromByteArray(bytes), {
      encoding: FS.EncodingType.Base64,
    });
    return "saved";
  } catch (error) {
    if (destination)
      await FS.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw new Error(
      "Could not save to that folder. Your PDF is safe in Folio. Try another folder or use Share PDF.",
      { cause: error },
    );
  }
}

/** Export independent PDFs that can be copied to another phone or saved in a Drive folder. */
export async function exportLibraryPdfs(onProgress: (message: string) => void) {
  if (Platform.OS !== "android")
    throw new Error("Use Share PDF to export documents on this device.");
  const { listDocuments } = await import("../../database");
  const docs = (await listDocuments()).filter((doc) => !doc.sensitive);
  if (!docs.length)
    throw new Error("There are no regular documents to back up.");
  const permission =
    await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return null;
  let exported = 0;
  const failed: string[] = [];
  for (const [index, doc] of docs.entries()) {
    onProgress(`Exporting ${index + 1} / ${docs.length}`);
    let destination: string | undefined;
    try {
      const bytes = await readBytes(doc.uri);
      destination = await FS.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        pdfFilename(
          `${doc.title.replace(/\.pdf$/i, "")} - ${doc.id.slice(0, 8)}`,
        ),
        "application/pdf",
      );
      await FS.writeAsStringAsync(destination, fromByteArray(bytes), {
        encoding: FS.EncodingType.Base64,
      });
      exported++;
    } catch {
      if (destination)
        await FS.deleteAsync(destination, { idempotent: true }).catch(() => {});
      failed.push(doc.title);
    }
  }
  return { exported, failed };
}
