import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  os: "android",
  granted: true,
  fail: false,
  write: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
  share: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
}));
vi.mock("../apps/mobile/database", () => ({
  readBytes: async () => new Uint8Array([37, 80, 68, 70]),
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync: state.share,
}));
vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: async () => ({
      granted: state.granted,
      directoryUri: "content://folder",
    }),
    createFileAsync: async (...args: unknown[]) => {
      state.create(...args);
      return "content://folder/copy.pdf";
    },
  },
  writeAsStringAsync: async (...args: unknown[]) => {
    state.write(...args);
    if (state.fail) throw new Error("full");
  },
  deleteAsync: async (...args: unknown[]) => {
    state.remove(...args);
  },
}));
import {
  exportPdf,
  pdfFilename,
} from "../apps/mobile/features/documents/export";
const doc = { uri: "file:///private/document.pdf", title: "Invoice" };
beforeEach(() => {
  vi.clearAllMocks();
  state.os = "android";
  state.granted = true;
  state.fail = false;
});
it("writes real PDF bytes into the user-selected Android folder", async () => {
  expect(await exportPdf(doc)).toBe("saved");
  expect(state.create).toHaveBeenCalledWith(
    "content://folder",
    "Invoice.pdf",
    "application/pdf",
  );
  expect(state.write).toHaveBeenCalledWith(
    "content://folder/copy.pdf",
    "JVBERg==",
    { encoding: "base64" },
  );
  expect(state.remove).not.toHaveBeenCalled();
});
it("does not create a file when the folder picker is cancelled", async () => {
  state.granted = false;
  expect(await exportPdf(doc)).toBe("cancelled");
  expect(state.create).not.toHaveBeenCalled();
});
it("cleans up a partial export and preserves the library original", async () => {
  state.fail = true;
  await expect(exportPdf(doc)).rejects.toThrow("safe in Folio");
  expect(state.remove).toHaveBeenCalledExactlyOnceWith(
    "content://folder/copy.pdf",
    { idempotent: true },
  );
});
it("opens the iOS Files share flow without claiming the user saved", async () => {
  state.os = "ios";
  expect(await exportPdf(doc)).toBe("shared");
  expect(state.share).toHaveBeenCalled();
  expect(state.create).not.toHaveBeenCalled();
});
it("makes safe filenames without duplicate PDF extensions", () => {
  expect(pdfFilename(" Scan 18/11/2026.PDF ")).toBe("Scan 18 11 2026.pdf");
  expect(pdfFilename(" ")).toBe("Document.pdf");
});
