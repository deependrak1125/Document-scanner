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
