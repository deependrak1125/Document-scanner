import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pick: vi.fn(),
  copy: vi.fn(),
  info: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "picked-pdf" }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///app/cache/",
  copyAsync: mocks.copy,
  getInfoAsync: mocks.info,
  deleteAsync: mocks.remove,
}));
vi.mock("../apps/mobile/database", () => ({ readBytes: vi.fn() }));

describe("PDF picker on Android", () => {
  it("copies the granted content URI into Folio storage before returning it", async () => {
    mocks.pick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "content://provider/report", name: "report.pdf", size: 120 }],
    });
    mocks.copy.mockResolvedValue(undefined);
    mocks.info.mockResolvedValue({ exists: true, size: 120 });
    const { selectPdfs } = await import("../apps/mobile/features/pdf");
    const selected = await selectPdfs();
    expect(mocks.pick).toHaveBeenCalledWith({
      type: "application/pdf",
      copyToCacheDirectory: false,
      multiple: false,
    });
    expect(mocks.copy).toHaveBeenCalledWith({
      from: "content://provider/report",
      to: "file:///app/cache/folio-import-picked-pdf.pdf",
    });
    expect(selected[0].uri).toBe("file:///app/cache/folio-import-picked-pdf.pdf");
  });
});
