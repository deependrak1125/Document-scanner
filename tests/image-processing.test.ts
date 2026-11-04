import { beforeEach, expect, it, vi } from "vitest";
import type { ScanPage } from "@folio/shared-types";
const native = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock("expo-modules-core", () => ({ requireNativeModule: () => native }));
import { processImage } from "../apps/mobile/native/image";
const page: ScanPage = {
  id: "page",
  uri: "file:///source.jpg",
  originalUri: "file:///source.jpg",
  width: 600,
  height: 800,
  rotation: 0,
  filter: "original",
};
beforeEach(() => {
  native.process.mockReset();
  native.process.mockImplementation(
    async (_uri, filter, _brightness, _contrast, corners) => ({
      uri: corners.length ? "file:///crop.jpg" : `file:///${filter}.jpg`,
      width: 400,
      height: 500,
    }),
  );
});
it("switches from B&W back to original using untouched color pixels", async () => {
  const bw = await processImage(page, "bw");
  const color = await processImage(bw, "clean");
  await processImage(color, "original", 0, 1);
  expect(native.process.mock.calls.map((call) => call[0])).toEqual([
    page.uri,
    page.uri,
    page.uri,
  ]);
  expect(color.editBaseUri).toBe(page.uri);
});
it("preserves an unfiltered cropped base when changing presets", async () => {
  const crop = await processImage(
    { ...page, editBaseUri: page.uri, uri: "file:///bw.jpg", filter: "bw" },
    "clean",
    0,
    1,
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  );
  await processImage(crop, "color");
  expect(native.process.mock.calls[0].slice(0, 4)).toEqual([
    page.uri,
    "original",
    0,
    1,
  ]);
  expect(native.process.mock.calls[1][0]).toBe("file:///crop.jpg");
  expect(native.process.mock.calls[2][0]).toBe("file:///crop.jpg");
});
it("keeps adjustment values and invalidates outdated OCR", async () => {
  const changed = await processImage(
    { ...page, text: "old", words: [] },
    "clean",
    0.1,
    1.2,
  );
  await processImage(changed, "color");
  expect(native.process.mock.calls[1].slice(1, 4)).toEqual(["color", 0.1, 1.2]);
  expect(changed.text).toBeUndefined();
  expect(changed.words).toBeUndefined();
});
