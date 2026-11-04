import MlkitOcr from "rn-mlkit-ocr";
import type { ScanPage } from "@folio/shared-types";
export async function recognize(
  page: ScanPage,
  language: "latin" | "devanagari" = "latin",
): Promise<ScanPage> {
  const result = await MlkitOcr.recognizeText(page.uri, language);
  if (!result || typeof result.text !== "string") throw new Error("Text recognition returned an invalid result. Reopen the app and try again.");
  return {
    ...page,
    text: result.text,
    words: (result.blocks ?? []).flatMap((b) =>
      (b.lines ?? []).flatMap((l) =>
        (l.elements ?? []).map((e) => ({ text: e.text, ...e.frame })),
      ),
    ),
  };
}
