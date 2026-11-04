import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  scan: vi.fn(),
  copy: vi.fn(),
  pick: vi.fn(),
  manipulate: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  PermissionsAndroid: {
    request: mocks.permission,
    PERMISSIONS: { CAMERA: "camera" },
    RESULTS: { GRANTED: "granted" },
  },
}));
vi.mock("react-native-document-scanner-plugin", () => ({
  default: { scanDocument: mocks.scan },
}));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.pick }));
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: mocks.manipulate,
  SaveFormat: { JPEG: "jpeg" },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "test-page-id" }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: mocks.copy,
}));
import {
  capture,
  importImages,
  rotatePage,
} from "../apps/mobile/features/scanner";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue("granted");
  mocks.manipulate.mockResolvedValue({
    uri: "file:///processed.jpg",
    width: 600,
    height: 800,
  });
});
describe("scanner adapter", () => {
  it("never launches capture after camera permission denial", async () => {
    mocks.permission.mockResolvedValue("denied");
    await expect(capture()).rejects.toThrow("Camera permission");
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("treats user cancellation as cancellation, not successful capture", async () => {
    mocks.scan.mockResolvedValue({ status: "cancel" });
    expect(await capture()).toEqual([]);
    expect(mocks.copy).not.toHaveBeenCalled();
  });
  it("normalizes real native file outputs and preserves an independent source", async () => {
    mocks.scan.mockResolvedValue({
      status: "success",
      scannedImages: ["file:///camera.jpg"],
    });
    const pages = await capture(true);
    expect(mocks.scan).toHaveBeenCalledWith(
      expect.objectContaining({ maxNumDocuments: 2 }),
    );
    expect(mocks.copy).toHaveBeenCalledWith({
      from: "file:///processed.jpg",
      to: "file:///cache/folio-test-page-id.jpg",
    });
    expect(pages[0].originalUri).toBe(pages[0].uri);
  });
  it("does not create pages on a cancelled gallery import", async () => {
    mocks.pick.mockResolvedValue({ canceled: true });
    expect(await importImages()).toEqual([]);
  });
  it("invalidates OCR geometry after pixel rotation", async () => {
    const result = await rotatePage({
      id: "a",
      uri: "file:///a.jpg",
      originalUri: "file:///original.jpg",
      width: 800,
      height: 600,
      rotation: 0,
      filter: "original",
      text: "text",
      words: [],
    });
    expect(result.rotation).toBe(90);
    expect(result.text).toBeUndefined();
    expect(result.originalUri).toBe("file:///original.jpg");
  });
});
