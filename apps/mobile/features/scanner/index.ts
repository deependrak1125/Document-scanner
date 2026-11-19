import {
  Image,
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
  type TurboModule,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import * as FS from "expo-file-system/legacy";
import type { ScanPage } from "@folio/shared-types";
import { useSettings } from "../../store";
import { isExpoGoRuntime } from "../../native/runtime";

type NativeDocumentScanner = TurboModule & {
  scanDocument(options: {
    croppedImageQuality: number;
    maxNumDocuments: number;
  }): Promise<{ status?: "success" | "cancel"; scannedImages?: string[] }>;
};

export class AutoScannerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutoScannerUnavailableError";
  }
}
export async function makePage(uri: string): Promise<ScanPage> {
  const dimensions = await Image.getSize(uri);
  const longest = Math.max(dimensions.width, dimensions.height);
  if (!Number.isFinite(longest) || longest <= 0)
    throw new Error(
      "The captured photo could not be opened. Please scan again.",
    );
  const resize =
    longest > 2400
      ? [
          {
            resize:
              dimensions.width >= dimensions.height
                ? { width: 2400 }
                : { height: 2400 },
          },
        ]
      : [];
  const image = await Manipulator.manipulateAsync(uri, resize, {
    format: Manipulator.SaveFormat.JPEG,
    compress: 1,
  });
  const id = Crypto.randomUUID();
  const originalUri = `${FS.cacheDirectory}folio-${id}.jpg`;
  await FS.copyAsync({ from: image.uri, to: originalUri });
  return {
    id,
    uri: originalUri,
    originalUri,
    editBaseUri: originalUri,
    width: image.width,
    height: image.height,
    rotation: 0,
    filter: "original",
  };
}
export async function capture(idMode = false, pageLimit = idMode ? 2 : 30) {
  if (isExpoGoRuntime())
    throw new Error(
      "Live document detection and auto capture require the installed Folio app. Expo Go does not include this scanner. Run npm run android from the project folder and open Folio.",
    );
  if (Platform.OS === "android") {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error(
        "Camera permission is required to scan. You can still import existing files.",
      );
  }
  // A stale development binary may not contain the auto scanner. Never open a
  // generic camera here: it would silently lose edge detection and enhancement.
  const scanner =
    TurboModuleRegistry.get<NativeDocumentScanner>("DocumentScanner");
  if (!scanner)
    throw new AutoScannerUnavailableError(
      "This Folio installation is missing automatic document scanning. Install the latest Folio APK, or use the Folio camera to crop and clean pages after capture.",
    );
  let result;
  try {
    result = await scanner.scanDocument({
      croppedImageQuality: useSettings.getState().quality,
      maxNumDocuments: pageLimit,
    });
  } catch {
    throw new AutoScannerUnavailableError(
      "Automatic scanning could not start on this device. Try again, or use the Folio camera to crop and clean pages after capture.",
    );
  }
  if (result.status === "cancel") return [];
  const pages: ScanPage[] = [];
  for (const uri of result.scannedImages ?? []) {
    const page = await makePage(uri);
    if (idMode) {
      pages.push(page);
      continue;
    }
    try {
      const { processImage } = await import("../../native/image");
      pages.push(await processImage(page, "clean"));
    } catch {
      // The native scanner has already cropped and enhanced its JPEG.
      pages.push(page);
    }
  }
  return pages;
}
export async function autoEnhancePage(page: ScanPage): Promise<ScanPage> {
  const { detectCorners, processImage } = await import("../../native/image");
  const corners = await detectCorners(page.uri);
  return processImage(page, "clean", 0, 1, corners);
}
export async function importImages() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 30,
    quality: 1,
  });
  if (result.canceled) return [];
  const pages: ScanPage[] = [];
  for (const item of result.assets) pages.push(await makePage(item.uri));
  return pages;
}
export async function rotatePage(page: ScanPage) {
  const image = await Manipulator.manipulateAsync(
    page.editBaseUri ?? page.uri,
    [{ rotate: 90 }],
    {
      format: Manipulator.SaveFormat.JPEG,
      compress: 1,
    },
  );
  const rotated = {
    ...page,
    ...image,
    editBaseUri: image.uri,
    rotation: (page.rotation + 90) % 360,
    text: undefined,
    words: undefined,
  };
  if (
    page.filter === "original" &&
    !(page.brightness ?? 0) &&
    (page.contrast ?? 1) === 1
  )
    return rotated;
  const { processImage } = await import("../../native/image");
  return processImage(rotated, page.filter);
}
