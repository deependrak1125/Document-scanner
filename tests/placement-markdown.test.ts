import { expect, it } from "vitest";
import { pdfPlacement } from "../apps/mobile/features/signature/placement";
import { documentMarkdown } from "../apps/mobile/features/pdf/markdown";
const rect = { left: 0.1, top: 0.2, width: 0.3, height: 0.1 };
const box = { x: 10, y: 20, width: 600, height: 800 };
it.each([
  [0, { x: 70, y: 580, width: 180, height: 80, rotation: 0 }],
  [90, { x: 190, y: 100, width: 240, height: 60, rotation: 90 }],
  [180, { x: 550, y: 260, width: 180, height: 80, rotation: 180 }],
  [270, { x: 430, y: 740, width: 240, height: 60, rotation: 270 }],
])(
  "maps visual placement into rotated PDF coordinates (%i)",
  (angle, expected) => {
    expect(pdfPlacement(rect, box, angle as number)).toEqual(expected);
  },
);
it("exports OCR page boundaries and escapes markdown/HTML from documents", () => {
  const result = documentMarkdown("Test\nfile", [
    "<script>*hello*</script>",
    "हिन्दी",
  ]);
  expect(result).toContain("# Test file");
  expect(result).toContain("## Page 2\n\nहिन्दी");
  expect(result).toContain("\\<script\\>\\*hello\\*");
});
it("rejects empty Markdown instead of exporting an empty success", () => {
  expect(() => documentMarkdown("Test", [" "])).toThrow("Recognize text");
});
