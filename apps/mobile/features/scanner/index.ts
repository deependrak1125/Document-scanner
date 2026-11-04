import DocumentScanner from "react-native-document-scanner-plugin";
import { PermissionsAndroid, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import * as FS from "expo-file-system/legacy";
import type { ScanPage } from "@folio/shared-types";
import { useSettings } from "../../store";
export async function makePage(uri: string): Promise<ScanPage> {
  const image = await Manipulator.manipulateAsync(uri, [], {
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
export async function capture(idMode = false) {
  if (Platform.OS === "android") {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (permission !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error(
        "Camera permission is required to scan. You can still import existing files.",
      );
  }
  const result = await DocumentScanner.scanDocument({
    croppedImageQuality: useSettings.getState().quality,
    maxNumDocuments: idMode ? 2 : 30,
  });
  if (result.status === "cancel") return [];
  const pages: ScanPage[] = [];
  for (const uri of result.scannedImages ?? []) pages.push(await makePage(uri));
  return pages;
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
