import * as Picker from "expo-document-picker";
import { readBytes, savePdf } from "../../database";
export async function importPdf() {
  const result = await Picker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 100 * 1024 * 1024)
    throw new Error("Choose a PDF smaller than 100 MB.");
  return savePdf(asset.name.replace(/\.pdf$/i, ""), await readBytes(asset.uri));
}

export async function restoreLibraryPdfs(
  onProgress: (message: string) => void,
) {
  const { selectPdfs } = await import("../pdf");
  const FS = await import("expo-file-system/legacy");
  const files = await selectPdfs(true);
  if (!files.length) return null;
  let restored = 0;
  const failed: string[] = [];
  for (const [index, file] of files.entries()) {
    onProgress(`Importing ${index + 1} / ${files.length}`);
    try {
      await savePdf(
        file.name.replace(/\.pdf$/i, ""),
        await readBytes(file.uri),
      );
      restored++;
    } catch {
      failed.push(file.name);
    } finally {
      await FS.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
    }
  }
  return { restored, failed };
}
