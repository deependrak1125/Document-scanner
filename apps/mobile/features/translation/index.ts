import { requireNativeModule } from "expo-modules-core";
export type Language = "en" | "hi";
export async function translateText(
  text: string,
  source: Language,
  target: Language,
  onProgress: (message: string) => void = () => {},
) {
  if (!text.trim())
    throw new Error("Recognize text first, or enter text to translate.");
  if (source === target) return text;
  if (text.length > 100000)
    throw new Error("Translate up to 100,000 characters at a time.");
  const native = requireNativeModule<{
    translate?: (
      text: string,
      source: string,
      target: string,
    ) => Promise<string>;
  }>("FolioImage");
  if (!native.translate)
    throw new Error(
      "Install the updated Folio Android build to enable translation. A Metro reload alone cannot add this native feature.",
    );
  const chunks = text.match(/[\s\S]{1,4000}(?:\s|$)|[\s\S]{1,4000}/g) ?? [];
  const result: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    onProgress(
      index === 0
        ? "Preparing language model… First use needs Wi-Fi."
        : `Translating ${index + 1} of ${chunks.length}…`,
    );
    result.push(await native.translate(chunk, source, target));
  }
  onProgress("Translation complete");
  return result.join("\n");
}
