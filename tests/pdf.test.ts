import { describe, expect, it } from "vitest";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import {
  imagesToPdf,
  editPdf,
  mergePdfs,
  parsePageSelection,
} from "../packages/pdf/src/index";
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHfoAAAAASUVORK5CYII=",
    "base64",
  ),
);
async function fixture(count = 3) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++)
    pdf.addPage([300 + i * 20, 400 + i * 20]).drawText(`Page ${i + 1}`);
  return pdf.save();
}
describe("real PDF processing", () => {
  it("creates and reloads a multipage PDF with standard paper dimensions", async () => {
    const bytes = await imagesToPdf(
      [
        { bytes: png, type: "png" },
        { bytes: png, type: "png" },
      ],
      { paper: "Letter" },
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
  it("fits both ID sides on a single page", async () => {
    const bytes = await imagesToPdf(
      [
        { bytes: png, type: "png" },
        { bytes: png, type: "png" },
      ],
      { idLayout: "horizontal" },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("reorders, extracts, rotates and leaves the source unchanged", async () => {
    const input = await fixture();
    const result = await PDFDocument.load(
      await editPdf(input, {
        order: [2, 0],
        rotation: 90,
        pageNumbers: true,
        watermark: "COPY",
      }),
    );
    expect(result.getPageCount()).toBe(2);
    expect(result.getPage(0).getWidth()).toBe(340);
    expect(result.getPage(0).getRotation().angle).toBe(90);
    expect((await PDFDocument.load(input)).getPage(0).getRotation().angle).toBe(
      0,
    );
  });
  it("merges independent PDFs preserving page order", async () => {
    const result = await PDFDocument.load(
      await mergePdfs([await fixture(2), await fixture(1)]),
    );
    expect(result.getPageCount()).toBe(3);
    expect(result.getPage(2).getWidth()).toBe(300);
  });
  it("actually embeds invisible OCR text operators", async () => {
    const bytes = await imagesToPdf([
      {
        bytes: png,
        type: "png",
        width: 100,
        height: 100,
        words: [
          { text: "Folio searchable", x: 5, y: 5, width: 80, height: 10 },
        ],
      },
    ]);
    const pdf = await PDFDocument.load(bytes);
    const streams = pdf.context
      .enumerateIndirectObjects()
      .filter(([, v]) => v instanceof PDFRawStream)
      .map(([, v]) => {
        try {
          return Buffer.from(
            decodePDFRawStream(v as PDFRawStream).decode(),
          ).toString();
        } catch {
          return "";
        }
      })
      .join("\n");
    expect(streams).toContain("3 Tr");
    expect(streams).toContain(
      Buffer.from("Folio searchable").toString("hex").toUpperCase(),
    );
  });
  it("validates page selections and crop paper margins", async () => {
    expect(parsePageSelection("3,1-2", 3)).toEqual([2, 0, 1]);
    expect(() => parsePageSelection("0,9", 3)).toThrow();
    expect(() => parsePageSelection("1-500000", 3)).toThrow();
    await expect(editPdf(await fixture(), { order: [] })).rejects.toThrow();
    await expect(
      imagesToPdf([{ bytes: png, type: "png" }], { margin: 400 }),
    ).rejects.toThrow();
  });
  it("exports signatures and annotations into the actual file", async () => {
    const bytes = await editPdf(await fixture(1), {
      signature: { png, page: 0, x: 20, y: 20, width: 90, height: 30 },
      notes: [{ page: 0, text: "Reviewed", x: 20, y: 80 }],
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPage(0).node.Resources()).toBeDefined();
    expect(bytes.length).toBeGreaterThan((await fixture(1)).length);
  });
});

it("exports long translated Hindi/English text with an embedded font and pagination", async () => {
  const { readFile } = await import("node:fs/promises");
  const { textToPdf } = await import("../packages/pdf/src");
  const font = await readFile(
    new URL(
      "../node_modules/@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf",
      import.meta.url,
    ),
  );
  const bytes = await textToPdf(
    "नमस्ते दुनिया — Hello world\n".repeat(100),
    font,
  );
  const result = await PDFDocument.load(bytes);
  expect(result.getPageCount()).toBeGreaterThan(1);
  expect(bytes.length).toBeGreaterThan(1000);
});
