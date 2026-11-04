import { requireNativeModule } from "expo-modules-core";
import type { Filter, ScanPage } from "@folio/shared-types";
export type Corner = [number, number];
export async function processImage(
  page: ScanPage,
  filter: Filter,
  brightness = page.brightness ?? 0,
  contrast = page.contrast ?? 1,
  corners: Corner[] = [],
): Promise<ScanPage> {
  const native = requireNativeModule<{
    process: (
      uri: string,
      filter: string,
      brightness: number,
      contrast: number,
      corners: Corner[],
    ) => Promise<{ uri: string; width: number; height: number }>;
  }>("FolioImage");
  // Keep geometry separate from appearance: switching a preset must not
  // process pixels from the previous preset (B&W would permanently lose color).
  let editBaseUri = page.editBaseUri ?? page.uri;
  let geometry = { width: page.width, height: page.height };
  if (corners.length) {
    const cropped = await native.process(
      editBaseUri,
      "original",
      0,
      1,
      corners,
    );
    editBaseUri = cropped.uri;
    geometry = cropped;
  }
  const image = await native.process(
    editBaseUri,
    filter,
    brightness,
    contrast,
    [],
  );
  return {
    ...page,
    ...geometry,
    ...image,
    editBaseUri,
    filter,
    brightness,
    contrast,
    text: undefined,
    words: undefined,
  };
}

export async function rasterizePdf(uri: string, index: number) {
  return requireNativeModule<{
    rasterize: (
      uri: string,
      index: number,
    ) => Promise<{ uri: string; width: number; height: number }>;
  }>("FolioImage").rasterize(uri, index);
}
export async function detectCorners(uri: string): Promise<Corner[]> {
  return requireNativeModule<{ detect: (uri: string) => Promise<Corner[]> }>(
    "FolioImage",
  ).detect(uri);
}
