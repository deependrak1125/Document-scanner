import { useEffect, useState } from "react";
import { rasterizePdf } from "../native/image";

export type PageImage = { uri: string; width: number; height: number };
const previews = new Map<string, PageImage>();
export function usePdfPage(uri: string, page: number) {
  const key = `${uri}:${page}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    image?: PageImage;
    error?: string;
  }>({ key });
  useEffect(() => {
    let active = true;
    const cached = previews.get(key);
    setResult({ key, image: cached });
    if (!cached) {
      void rasterizePdf(uri, page)
        .then((image) => {
          if (previews.size >= 12)
            previews.delete(previews.keys().next().value!);
          previews.set(key, image);
          if (active) setResult({ key, image });
        })
        .catch((error) => {
          if (active)
            setResult({
              key,
              error:
                error instanceof Error
                  ? error.message
                  : "Could not render this PDF page.",
            });
        });
    }
    return () => {
      active = false;
    };
  }, [key, uri, page, attempt]);
  return {
    image: result.key === key ? result.image : undefined,
    error: result.key === key ? result.error : undefined,
    retry: () => {
      previews.delete(key);
      setAttempt((v) => v + 1);
    },
  };
}
