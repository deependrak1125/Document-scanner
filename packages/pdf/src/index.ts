import "regenerator-runtime/runtime.js";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  setTextRenderingMode,
  TextRenderingMode,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export interface ImagePage {
  bytes: Uint8Array;
  type: "jpg" | "png";
  words?: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  width?: number;
  height?: number;
}
export type Paper = "A4" | "Letter" | "Legal" | "Auto";
const sizes = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
} as const;
export async function imagesToPdf(
  images: ImagePage[],
  options: {
    paper?: Paper;
    margin?: number;
    landscape?: boolean;
    font?: Uint8Array;
    idLayout?: "horizontal" | "vertical";
  } = {},
) {
  if (!images.length || images.length > 100)
    throw new Error("Choose between 1 and 100 images.");
  const pdf = await PDFDocument.create();
  pdf.setCreator("Folio");
  pdf.setProducer("Folio");
  pdf.registerFontkit(fontkit);
  const font = options.font
    ? await pdf.embedFont(options.font, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);
  if (options.idLayout && images.length !== 2)
    throw new Error("ID cards require exactly two images.");
  const margin = options.margin ?? 24;
  let idPage: ReturnType<typeof pdf.addPage> | undefined;
  for (const [index, item] of images.entries()) {
    const image =
      item.type === "png"
        ? await pdf.embedPng(item.bytes)
        : await pdf.embedJpg(item.bytes);
    const paper = options.paper ?? "A4";
    let [w, h] =
      paper === "Auto"
        ? [image.width + margin * 2, image.height + margin * 2]
        : [...sizes[paper]];
    if (options.landscape) [w, h] = [h, w];
    if (margin < 0 || margin * 2 >= Math.min(w, h))
      throw new Error("Invalid margins.");
    const page = options.idLayout
      ? (idPage ??= pdf.addPage([w, h]))
      : pdf.addPage([w, h]);
    const horizontal = options.idLayout === "horizontal";
    const slotW =
      options.idLayout && horizontal ? (w - margin * 3) / 2 : w - margin * 2;
    const slotH =
      options.idLayout && !horizontal ? (h - margin * 3) / 2 : h - margin * 2;
    const scale = Math.min(slotW / image.width, slotH / image.height);
    const dw = image.width * scale,
      dh = image.height * scale;
    const x =
      margin +
      (slotW - dw) / 2 +
      (options.idLayout && horizontal ? index * (slotW + margin) : 0);
    const y =
      margin +
      (slotH - dh) / 2 +
      (options.idLayout && !horizontal ? (1 - index) * (slotH + margin) : 0);
    page.drawImage(image, { x, y, width: dw, height: dh });
    for (const word of item.words ?? []) {
      if (!word.text.trim() || word.width <= 0 || word.height <= 0) continue;
      const sx = dw / (item.width ?? image.width),
        sy = dh / (item.height ?? image.height);
      // Reject unsupported scripts instead of silently dropping OCR text.
      const measured = font.widthOfTextAtSize(word.text, 1);
      const size = Math.min(
        word.height * sy,
        (word.width * sx) / Math.max(measured, 0.01),
      );
      page.pushOperators(
        pushGraphicsState(),
        setTextRenderingMode(TextRenderingMode.Invisible),
      );
      page.drawText(word.text, {
        x: x + word.x * sx,
        y: y + dh - (word.y + word.height) * sy,
        size,
        font,
      });
      page.pushOperators(popGraphicsState());
    }
  }
  return pdf.save();
}
export interface PdfEdit {
  order?: number[];
  rotation?: number;
  watermark?: string;
  pageNumbers?: boolean;
  signature?: {
    png: Uint8Array;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  notes?: { page: number; text: string; x: number; y: number }[];
}
export async function editPdf(input: Uint8Array, edit: PdfEdit) {
  const source = await PDFDocument.load(input);
  const order = edit.order ?? source.getPageIndices();
  if (
    !order.length ||
    order.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= source.getPageCount(),
    )
  )
    throw new Error("Invalid page selection.");
  const result = await PDFDocument.create();
  for (const page of await result.copyPages(source, order))
    result.addPage(page);
  const font = await result.embedFont(StandardFonts.Helvetica);
  for (const [index, page] of result.getPages().entries()) {
    if (edit.rotation !== undefined) {
      if (edit.rotation % 90)
        throw new Error("Rotation must be a multiple of 90.");
      page.setRotation(
        degrees((page.getRotation().angle + edit.rotation) % 360),
      );
    }
    if (edit.watermark)
      page.drawText(edit.watermark, {
        x: 30,
        y: page.getHeight() / 2,
        size: 28,
        font,
        rotate: degrees(35),
        opacity: 0.22,
        color: rgb(0.1, 0.45, 0.5),
      });
    if (edit.pageNumbers)
      page.drawText(`${index + 1} / ${order.length}`, {
        x: page.getWidth() / 2 - 15,
        y: 12,
        size: 9,
        font,
      });
  }
  if (edit.signature) {
    const s = edit.signature;
    const page = result.getPage(s.page);
    page.drawImage(await result.embedPng(s.png), {
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotate: degrees(s.rotation ?? 0),
    });
  }
  for (const note of edit.notes ?? [])
    result
      .getPage(note.page)
      .drawText(note.text, { x: note.x, y: note.y, font, size: 12 });
  return result.save();
}
export async function mergePdfs(inputs: Uint8Array[]) {
  if (inputs.length < 2) throw new Error("Choose at least two PDFs.");
  const result = await PDFDocument.create();
  for (const input of inputs) {
    const source = await PDFDocument.load(input);
    for (const page of await result.copyPages(source, source.getPageIndices()))
      result.addPage(page);
  }
  return result.save();
}
export function parsePageSelection(value: string, count: number): number[] {
  const pages: number[] = [];
  for (const part of value.split(",")) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!match) throw new Error("Use page numbers or ranges, such as 1,3-5.");
    const start = Number(match[1]),
      end = Number(match[2] ?? start);
    if (start < 1 || end > count || end < start)
      throw new Error("Page range is outside this document.");
    for (let i = start; i <= end; i++) pages.push(i - 1);
  }
  return pages;
}

/** Reflowed text export; it deliberately does not replace the original PDF layout. */
export async function textToPdf(text: string, fontBytes: Uint8Array) {
  if (!text.trim() || text.length > 100000)
    throw new Error("Enter between 1 and 100,000 characters.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const size = 12,
    margin = 42,
    lineHeight = 20,
    maxWidth = 595.28 - margin * 2;
  let page = pdf.addPage([595.28, 841.89]),
    y = 841.89 - margin - size;
  function draw(line: string) {
    if (y < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = 841.89 - margin - size;
    }
    page.drawText(line, { x: margin, y, size, font });
    y -= lineHeight;
  }
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) draw(line);
      line = "";
      for (const letter of Array.from(word)) {
        if (line && font.widthOfTextAtSize(line + letter, size) > maxWidth) {
          draw(line);
          line = "";
        }
        line += letter;
      }
    }
    draw(line);
  }
  return pdf.save();
}
