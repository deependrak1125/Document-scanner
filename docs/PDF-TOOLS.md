# PDF tools and translation

The Tools tab is now a searchable entry point to 22 connected actions in a category grid, organized after reviewing the tool categories at https://www.ilovepdf.com/. This is an original implementation; it is not complete feature parity with that service.

## Available flows

- Merge PDFs with a review screen, output naming and file reorder/removal (up to 20 inputs / 60 MB combined); split/extract selected ranges; remove selected pages; reorder; rotate; page numbers; text watermark.
- JPG/photos to PDF and camera scans to PDF.
- PDF filters and crop: rasterize imported PDF pages, open the editor, process pixels, and save an image PDF copy. Original files are retained. Image processing removes existing interactive fields, links and text layers from the new image copy; OCR can generate a new searchable copy.
- PDF to JPG: enter one page number, then export that page locally.
- Offline compression: rasterize at bounded resolution and JPEG quality, save only if the result is smaller. This is lossy image compression and removes the original text layer and forms. It is most useful for scanned PDFs.
- OCR for English/Hindi, searchable PDF generation, TXT export and copy.
- Drag/resize signatures on a page preview; rotation-aware PDF placement preserves the existing PDF pages. Text notes remain available under advanced placement.
- PDF to Markdown: OCR text with page headings, escaped source text and .md sharing. This is a text export, not layout/table reconstruction.
- Hindi ↔ English document-text translation, editable output, copy/TXT and reflowed text PDF export. The translated PDF does not preserve the original layout. If no OCR text exists, Recognize & translate runs OCR first.
- Protect/unlock and lossless cloud processing use the existing signed-in API/qpdf service and require explicit file upload consent and configured infrastructure.

## Newly implemented advanced tools

- Fill existing interactive PDF forms: text fields, checkboxes, dropdowns, lists and radio groups. Saves an editable new copy; read-only and unsupported fields are identified. Automatic field detection and creating fields are not implemented.
- Compare PDFs: synchronized page selection with independent zoom; side by side in landscape/tablet and stacked in portrait. Visual review only, without automatic difference highlighting.
- Office to PDF: DOCX, XLSX and PPTX through the authenticated LibreOffice server endpoint. Explicit per-file upload consent, temporary-file cleanup and a configured server are required. Local test fixtures converted with text verified. Legacy DOC/XLS/PPT and PDF-to-Office are not supported.

## Filters

Original, Clean color (white paper with colored ink), Remove shadows, Vivid color, Grayscale, Black & white, Soften and Sharpen. Brightness and contrast can be increased or decreased. The editor shows real processed thumbnail previews and a fixed Save / Save & Share footer. Apply one look to all pages, then undo the batch in one step. Session undo/redo retains up to 20 snapshots; drafts are not persisted across app restarts.

Filters now render from a separate unfiltered image with the current crop/rotation. Switching away from B&W therefore restores the source colors. Crop and rotation preserve an independent edit base, and save/reopen persists that base. Previously saved scans without this base may need Reset to recover the original image, then recropping. A source captured in B&W cannot reconstruct colors that were never recorded.

Clean color estimates paper illumination and applies a common RGB gain, rather than normalizing each color channel independently. Tests check gray background whitening, red/blue ink separation and pale-color retention. Extremely dark, glossy or colored paper still requires real-photo quality evaluation.

## Translation installation

An updated native app is required. Reloading Metro cannot add the ML Kit translation module. The first translation downloads the required model on Wi-Fi; subsequent translations use the downloaded model on-device. Document text is not sent to a translation server. Model download size is roughly 30 MB, per Google's documentation:
https://developers.google.com/ml-kit/language/translation/android
https://developers.google.com/ml-kit/language/translation/ios

## Not implemented / not certified

PDF-to-Office reconstruction, legacy Office formats, PDF/A conversion, PDF repair, automatic form detection/creation, certified electronic signatures, permanent redaction, automatic difference detection and AI summarization are not implemented. No inert buttons are presented for them. Cloud password tools require a configured service; they are not offline tools. Store/provider and physical-device gates in FEATURES.md remain in effect.

Android emulator verification is now in progress; see VERIFICATION.md for the exact completed flows. Emulator checks do not certify physical-camera quality, translation accuracy or production readiness. iOS remains uncompiled on this host.
