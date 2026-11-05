import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import {
  officeToPdf,
  type OfficeExtension,
} from "../services/api/src/office-conversion";
it("rejects invalid containers before invoking the converter", async () => {
  await expect(
    officeToPdf(Buffer.from("not an office document"), "docx"),
  ).rejects.toThrow("DOCX");
});
it
  .runIf(process.env.TEST_OFFICE_CONVERSION === "1")
  .each(["docx", "xlsx", "pptx"] as OfficeExtension[])(
  "converts a real %s fixture into a readable PDF",
  async (extension) => {
    const bytes = await readFile(
      new URL(`./fixtures/office/sample.${extension}`, import.meta.url),
    );
    const result = await officeToPdf(bytes, extension);
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBe(1);
    expect(result.subarray(0, 5).toString()).toBe("%PDF-");
  },
  100000,
);
