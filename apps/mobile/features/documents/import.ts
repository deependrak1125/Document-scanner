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
