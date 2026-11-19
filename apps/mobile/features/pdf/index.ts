import * as Picker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import * as FS from "expo-file-system/legacy";
import { Platform } from "react-native";
import { PDFDocument } from "pdf-lib";
import {
  editPdf,
  mergePdfs,
  parsePageSelection,
  type PdfEdit,
} from "@folio/pdf";
import { readBytes, savePdf } from "../../database";
export async function selectPdfs(multiple = false) {
  const result = await Picker.getDocumentAsync({
    type: "application/pdf",
    // Android grants read access to the selected content URI. Copy that URI
    // directly into our own cache before the picker permission expires.
    copyToCacheDirectory: Platform.OS !== "android",
    multiple,
  });
  if (result.canceled) return [];
  if (result.assets.some((a) => (a.size ?? 0) > 30 * 1048576))
    throw new Error("Choose PDFs under 30 MB for in-memory editing.");
  const copies = [];
  try {
    for (const asset of result.assets) {
      const uri = `${FS.cacheDirectory}folio-import-${Crypto.randomUUID()}.pdf`;
      copies.push(uri);
      await FS.copyAsync({ from: asset.uri, to: uri });
      const info = await FS.getInfoAsync(uri);
      if (!info.exists || !info.size)
        throw new Error(
          `The selected PDF “${asset.name}” is empty or unavailable.`,
        );
      if (info.size > 30 * 1048576)
        throw new Error("Choose PDFs under 30 MB for in-memory editing.");
      // The returned URI now belongs to Folio, so later actions can read it.
      asset.uri = uri;
      asset.size = info.size;
    }
    return result.assets;
  } catch (error) {
    await Promise.all(
      copies.map((uri) =>
        FS.deleteAsync(uri, { idempotent: true }).catch(() => {}),
      ),
    );
    throw error;
  }
}
export async function mergeFiles() {
  const files = await selectPdfs(true);
  if (!files.length) return null;
  const bytes = [];
  for (const file of files) bytes.push(await readBytes(file.uri));
  return savePdf("Merged document", await mergePdfs(bytes));
}
export async function editFile(uri: string, title: string, edit: PdfEdit) {
  return savePdf(title, await editPdf(await readBytes(uri), edit));
}
export async function selectPages(uri: string, value: string) {
  const bytes = await readBytes(uri),
    pdf = await PDFDocument.load(bytes);
  return parsePageSelection(value, pdf.getPageCount());
}

export async function pdfToScanPages(
  uri: string,
  onProgress: (message: string) => void = () => {},
) {
  const pdf = await PDFDocument.load(await readBytes(uri));
  if (pdf.getPageCount() > 50)
    throw new Error(
      "Choose up to 50 pages for image processing. Split a larger PDF first.",
    );
  const { rasterizePdf } = await import("../../native/image");
  const { randomUUID } = await import("expo-crypto");
  const pages: import("@folio/shared-types").ScanPage[] = [];
  for (let i = 0; i < pdf.getPageCount(); i++) {
    onProgress(`Preparing page ${i + 1} of ${pdf.getPageCount()}…`);
    const image = await rasterizePdf(uri, i);
    pages.push({
      ...image,
      id: randomUUID(),
      originalUri: image.uri,
      editBaseUri: image.uri,
      rotation: 0,
      filter: "original",
    });
  }
  return pages;
}

export async function removePages(uri: string, value: string) {
  const pdf = await PDFDocument.load(await readBytes(uri));
  const excluded = new Set(parsePageSelection(value, pdf.getPageCount()));
  const order = Array.from(
    { length: pdf.getPageCount() },
    (_, index) => index,
  ).filter((index) => !excluded.has(index));
  if (!order.length) throw new Error("Keep at least one page in the PDF.");
  return order;
}

export async function compressPdfLocally(
  uri: string,
  name: string,
  onProgress: (message: string) => void = () => {},
  targetBytes?: number,
) {
  if (
    targetBytes !== undefined &&
    (!Number.isSafeInteger(targetBytes) || targetBytes < 1024)
  )
    throw new Error("Enter a target of at least 1 KB.");
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");
  const { imagesToPdf } = await import("@folio/pdf");
  const original = await readBytes(uri);
  if (targetBytes !== undefined && original.length <= targetBytes)
    throw new Error(
      "This PDF already fits your target size. Use the original for best quality.",
    );
  const pages = await pdfToScanPages(uri, onProgress);
  const profiles =
    targetBytes === undefined
      ? [[1600, 0.55]]
      : [
          [1800, 0.75],
          [1600, 0.55],
          [1200, 0.45],
          [900, 0.35],
          [640, 0.28],
        ];
  let smallest = original.length;
  try {
    for (const [edge, quality] of profiles) {
      const images = [];
      for (const [index, page] of pages.entries()) {
        onProgress(`Compressing page ${index + 1} of ${pages.length}…`);
        const resize =
          Math.max(page.width, page.height) > edge
            ? [
                {
                  resize:
                    page.width > page.height
                      ? { width: edge }
                      : { height: edge },
                },
              ]
            : [];
        const image = await manipulateAsync(page.uri, resize, {
          compress: quality,
          format: SaveFormat.JPEG,
        });
        try {
          images.push({
            bytes: await readBytes(image.uri),
            type: "jpg" as const,
          });
        } finally {
          if (image.uri !== page.uri)
            await FS.deleteAsync(image.uri, { idempotent: true }).catch(
              () => {},
            );
        }
      }
      const result = await imagesToPdf(images, { paper: "Auto", margin: 0 });
      smallest = Math.min(smallest, result.length);
      if (
        result.length < original.length &&
        (targetBytes === undefined || result.length <= targetBytes)
      )
        return await savePdf(
          `${name.replace(/\.pdf$/i, "")} compressed`,
          result,
        );
    }
    throw new Error(
      targetBytes === undefined
        ? "This PDF is already smaller than the compressed image copy."
        : `Could not reach that target while keeping pages readable. Try at least ${Math.ceil(smallest / 1024)} KB.`,
    );
  } finally {
    await Promise.all(
      pages.map((page) =>
        FS.deleteAsync(page.uri, { idempotent: true }).catch(() => {}),
      ),
    );
  }
}
