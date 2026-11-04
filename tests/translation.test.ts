import { beforeEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ translate: vi.fn() }));
vi.mock("expo-modules-core", () => ({ requireNativeModule: () => native }));
import { translateText } from "../apps/mobile/features/translation";
beforeEach(() => {
  native.translate.mockReset();
});
it("rejects empty input without invoking the translator", async () => {
  await expect(translateText("  ", "en", "hi")).rejects.toThrow(
    "Recognize text",
  );
  expect(native.translate).not.toHaveBeenCalled();
});
it("sends every character of long documents to bounded native requests", async () => {
  native.translate.mockImplementation(async (s: string) => s);
  const text = "Hello world.\n".repeat(900);
  await translateText(text, "en", "hi");
  expect(native.translate.mock.calls.map((c) => c[0]).join("")).toBe(text);
  expect(native.translate.mock.calls.every((c) => c[0].length <= 4001)).toBe(
    true,
  );
});
it("surfaces model or translation errors instead of returning success", async () => {
  native.translate.mockRejectedValue(new Error("Model unavailable"));
  await expect(translateText("Hello", "en", "hi")).rejects.toThrow(
    "Model unavailable",
  );
});
