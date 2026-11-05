import { expect, it, vi } from "vitest";
const recognizeText = vi.hoisted(() => vi.fn());
vi.mock("rn-mlkit-ocr", () => ({ default: { recognizeText } }));
import { recognize } from "../apps/mobile/features/ocr";
const page = {
  id: "1",
  uri: "file:///page.jpg",
  originalUri: "file:///original.jpg",
  width: 600,
  height: 800,
  filter: "original" as const,
  rotation: 0,
};
it("passes the selected OCR script and preserves native word coordinates", async () => {
  recognizeText.mockResolvedValue({
    text: "नमस्ते",
    blocks: [
      {
        lines: [
          {
            elements: [
              {
                text: "नमस्ते",
                frame: { x: 10, y: 20, width: 60, height: 18 },
              },
            ],
          },
        ],
      },
    ],
  });
  const result = await recognize(page, "devanagari");
  expect(recognizeText).toHaveBeenLastCalledWith(page.uri, "devanagari");
  expect(result.text).toBe("नमस्ते");
  expect(result.words).toEqual([
    { text: "नमस्ते", x: 10, y: 20, width: 60, height: 18 },
  ]);
});
it("handles empty native OCR results without crashing on missing blocks", async () => {
  recognizeText.mockResolvedValue({ text: "" });
  expect((await recognize(page)).words).toEqual([]);
});
it("does not present malformed results as successful recognition", async () => {
  recognizeText.mockResolvedValue(null);
  await expect(recognize(page)).rejects.toThrow("invalid result");
});
