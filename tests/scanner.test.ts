import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  scan: vi.fn(),
  nativeModule: vi.fn(),
  copy: vi.fn(),
  pick: vi.fn(),
  manipulate: vi.fn(),
  detect: vi.fn(),
  process: vi.fn(),
  expoGo: vi.fn(),
}));
vi.mock("../apps/mobile/native/runtime", () => ({
  isExpoGoRuntime: mocks.expoGo,
}));
vi.mock("react-native", () => ({
  Image: { getSize: async () => ({ width: 8000, height: 6000 }) },
  Platform: { OS: "android" },
  TurboModuleRegistry: { get: mocks.nativeModule },
  PermissionsAndroid: {
    request: mocks.permission,
    PERMISSIONS: { CAMERA: "camera" },
    RESULTS: { GRANTED: "granted" },
  },
}));
vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: mocks.pick,
}));
vi.mock("../apps/mobile/native/image", () => ({
  detectCorners: mocks.detect,
  processImage: mocks.process,
}));
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
  AutoScannerUnavailableError,
  autoEnhancePage,
  capture,
  importImages,
  rotatePage,
} from "../apps/mobile/features/scanner";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.permission.mockResolvedValue("granted");
  mocks.nativeModule.mockReturnValue({ scanDocument: mocks.scan });
  mocks.manipulate.mockResolvedValue({
    uri: "file:///processed.jpg",
    width: 600,
    height: 800,
  });
  mocks.process.mockImplementation(async (page, filter) => ({
    ...page,
    filter,
  }));
});
describe("scanner adapter", () => {
  it("blocks Expo Go before requesting permission or opening a camera", async () => {
    mocks.expoGo.mockReturnValue(true);
    await expect(capture()).rejects.toThrow(
      "Expo Go does not include this scanner",
    );
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.nativeModule).not.toHaveBeenCalled();
  });
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
  it("does not silently replace auto scanning with a plain camera", async () => {
    mocks.nativeModule.mockReturnValue(null);
    await expect(capture()).rejects.toBeInstanceOf(AutoScannerUnavailableError);
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.manipulate).not.toHaveBeenCalled();
  });
  it("reports when native document scanning is unavailable", async () => {
    mocks.scan.mockRejectedValue(new Error("scanner unavailable"));
    await expect(capture()).rejects.toBeInstanceOf(AutoScannerUnavailableError);
  });
  it("detects edges and applies Clean color in Folio camera mode", async () => {
    const page = {
      id: "x",
      uri: "file:///cache/photo.jpg",
      originalUri: "file:///cache/photo.jpg",
      width: 600,
      height: 800,
      rotation: 0,
      filter: "original" as const,
    };
    const corners: [number, number][] = [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.9, 0.9],
      [0.1, 0.9],
    ];
    mocks.detect.mockResolvedValue(corners);
    mocks.process.mockResolvedValue({ ...page, filter: "clean" });
    await autoEnhancePage(page);
    expect(mocks.detect).toHaveBeenCalledWith(page.uri);
    expect(mocks.process).toHaveBeenCalledWith(page, "clean", 0, 1, corners);
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
    expect(mocks.process).not.toHaveBeenCalled();
    expect(pages[0].originalUri).toBe(pages[0].uri);
    expect(mocks.manipulate).toHaveBeenCalledWith(
      "file:///camera.jpg",
      [{ resize: { width: 2400 } }],
      expect.anything(),
    );
  });
  it("applies Clean color automatically to a scanned document", async () => {
    mocks.scan.mockResolvedValue({
      status: "success",
      scannedImages: ["file:///scanner.jpg"],
    });
    const pages = await capture(false);
    expect(mocks.process).toHaveBeenCalledWith(
      expect.objectContaining({
        originalUri: "file:///cache/folio-test-page-id.jpg",
      }),
      "clean",
    );
    expect(pages[0].filter).toBe("clean");
  });
  it("opens a single-page scan for retakes while preserving automatic cleanup", async () => {
    mocks.scan.mockResolvedValue({
      status: "success",
      scannedImages: ["file:///scanner.jpg"],
    });
    const pages = await capture(false, 1);
    expect(mocks.scan).toHaveBeenCalledWith(
      expect.objectContaining({ maxNumDocuments: 1 }),
    );
    expect(pages[0].filter).toBe("clean");
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
