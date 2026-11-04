import * as Picker from "expo-document-picker";
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
    copyToCacheDirectory: true,
    multiple,
  });
  if (result.canceled) return [];
  if (result.assets.some((a) => (a.size ?? 0) > 30 * 1048576))
    throw new Error("Choose PDFs under 30 MB for in-memory editing.");
  return result.assets;
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
) {
  const { manipulateAsync, SaveFormat } =
    await import("expo-image-manipulator");
  const { imagesToPdf } = await import("@folio/pdf");
  const pages = await pdfToScanPages(uri, onProgress);
  const images = [];
  for (const [index, page] of pages.entries()) {
    onProgress(`Compressing page ${index + 1} of ${pages.length}…`);
    const image = await manipulateAsync(
      page.uri,
      [
        {
          resize: page.width > page.height ? { width: 1600 } : { height: 1600 },
        },
      ],
      { compress: 0.55, format: SaveFormat.JPEG },
    );
    images.push({ bytes: await readBytes(image.uri), type: "jpg" as const });
  }
  const result = await imagesToPdf(images, { paper: "Auto", margin: 0 });
  if (result.length >= (await readBytes(uri)).length)
    throw new Error(
      "This PDF is already smaller than the compressed image copy. Your original has been kept.",
    );
  return savePdf(`${name} compressed`, result);
}
