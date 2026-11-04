# PDF tools and translation

The Tools tab is now a searchable entry point to 18 connected actions, organized after reviewing the tool categories at https://www.ilovepdf.com/. This is an original implementation; it is not complete feature parity with that service.

## Available flows

- Merge PDFs; split/extract selected ranges; remove selected pages; reorder; rotate; page numbers; text watermark.
- JPG/photos to PDF and camera scans to PDF.
- PDF filters and crop: rasterize imported PDF pages, open the editor, process pixels, and save an image PDF copy. Original files are retained. Image processing removes existing interactive fields, links and text layers from the new image copy; OCR can generate a new searchable copy.
- PDF to JPG: enter one page number, then export that page locally.
- Offline compression: rasterize at bounded resolution and JPEG quality, save only if the result is smaller. This is lossy image compression and removes the original text layer and forms. It is most useful for scanned PDFs.
- OCR for English/Hindi, searchable PDF generation, TXT export and copy.
- Signatures and text notes via document details.
- Hindi ↔ English document-text translation, editable output, copy/TXT and reflowed text PDF export. The translated PDF does not preserve the original layout. If no OCR text exists, Recognize & translate runs OCR first.
- Protect/unlock and lossless cloud processing use the existing signed-in API/qpdf service and require explicit file upload consent and configured infrastructure.

## Filters

Original, Clean color (white paper with colored ink), Remove shadows, Vivid color, Grayscale, Black & white, Soften and Sharpen. Brightness and contrast can be increased or decreased.

Filters now render from a separate unfiltered image with the current crop/rotation. Switching away from B&W therefore restores the source colors. Crop and rotation preserve an independent edit base, and save/reopen persists that base. Previously saved scans without this base may need Reset to recover the original image, then recropping. A source captured in B&W cannot reconstruct colors that were never recorded.

Clean color estimates paper illumination and applies a common RGB gain, rather than normalizing each color channel independently. Tests check gray background whitening, red/blue ink separation and pale-color retention. Extremely dark, glossy or colored paper still requires real-photo quality evaluation.

## Translation installation

An updated native app is required. Reloading Metro cannot add the ML Kit translation module. The first translation downloads the required model on Wi-Fi; subsequent translations use the downloaded model on-device. Document text is not sent to a translation server. Model download size is roughly 30 MB, per Google's documentation:
https://developers.google.com/ml-kit/language/translation/android
https://developers.google.com/ml-kit/language/translation/ios

## Not implemented / not certified

Office-format conversion (Word/Excel/PowerPoint), PDF/A conversion, PDF repair, form filling, certified electronic signatures, permanent redaction, semantic comparison and AI summarization are not implemented. No inert buttons are presented for them. Cloud password tools require a configured service; they are not offline tools. Store/provider and physical-device gates in FEATURES.md remain in effect.

No Android device was connected during this update. Native compilation and automated tests do not establish translation accuracy, real-photo filter quality or touch acceptance. iOS remains uncompiled on this host.
