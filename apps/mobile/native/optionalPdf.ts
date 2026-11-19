import type { ComponentType } from "react";

export type PdfPreviewProps = {
  source: { uri: string; cache?: boolean };
  style?: object;
  page?: number;
  trustAllCerts?: boolean;
  enablePaging?: boolean;
  scrollEnabled?: boolean;
  onLoadComplete?: (pages: number) => void;
  onPageChanged?: (page: number) => void;
  onError?: (error: unknown) => void;
};

export function loadPdfPreview(): ComponentType<PdfPreviewProps> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("react-native-pdf") as {
      default?: ComponentType<PdfPreviewProps>;
    };
    return module.default ?? (module as unknown as ComponentType<PdfPreviewProps>);
  } catch {
    return null;
  }
}
