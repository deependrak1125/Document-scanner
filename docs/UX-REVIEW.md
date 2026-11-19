# PDF workspace UX review — 5 November 2026

Reviewed the publicly visible review samples on these Google Play listings, not the complete review history:

- [Document Scanner](https://play.google.com/store/apps/details?id=com.cv.docscanner): a reviewer described reversing a large page stack one page at a time. Folio now has **Reverse page order** under Pages & paper, using the existing undo history.
- [Kaagaz](https://play.google.com/store/apps/details?id=kaagaz.scanner.docs.pdf): visible feedback included difficult navigation, filename search and page fitting. Folio now trims accidental surrounding search whitespace, groups profile settings, and provides a full-screen PDF reader with explicit page navigation.
- [PDFelement](https://play.google.com/store/apps/details?id=com.wondershare.pdfelement): sampled feedback concerned purchase entitlements and watermark expectations. Folio keeps the verified plan check and restore entry together; signing explicitly saves a new copy without adding a watermark. This does not imply every cloud feature is free.

## User-reported problems addressed

- Signing has its own route, with the PDF visible before drawing a signature.
- Stable gesture responders keep signature dragging active while parent state changes. The page is bounded to the available screen height; dragging temporarily disables parent scrolling.
- Signature resizing preserves aspect ratio and stays inside the page. Tap-to-place and Smaller/Larger/Center controls offer alternatives to dragging.
- PDF viewing provides page navigation, full-screen mode and a raster fallback if the native viewer reports an error. Render errors show a retry action.
- Profile groups backup, appearance/security, purchases and privacy, with real local document count and PDF storage totals.

The native Folio APK/development build remains required for rasterization, scanner and on-device OCR. Expo Go cannot load these custom native modules. Text notes currently use PDF coordinates; arbitrary existing-text editing is not implemented. Physical-device verification is separate from emulator checks.

## 18 November 2026: scanner flow and visible review samples

Revisited the public listings for [Document Scanner](https://play.google.com/store/apps/details?id=com.cv.docscanner), [Image to PDF](https://play.google.com/store/apps/details?id=imagetopdf.pdfconverter.jpgtopdf.pdfeditor), and [OKEN](https://play.google.com/store/apps/details?id=com.cambyte.okenscan). These are visible review samples, not a complete review export or a hands-on review of their binaries.

- Document Scanner feedback mentions choosing filenames while scanning and a learning curve for its tools. Folio's document name field now appears at the top of Review.
- Image to PDF feedback praises smooth image conversion/reordering and criticizes interruptions. Folio retains its local conversion, page ordering and direct scan entry without inserting advertising into the workflow.
- OKEN reviewers report missing saved scans and want restoration after deletion. Folio retains its explicit app/phone save destinations and Trash restore; the direct scanner entry offers existing unsaved pages instead of discarding them.

Scan tab now launches the automatic native document scanner directly. A single-flight guard prevents overlapping launches. Cancellation stays on the originating screen. Edge detection, native crop/auto-capture and Clean color remain enabled. The camera's Review action is disabled while capture/enhancement is pending; the camera is unmounted before navigation. Camera images are bounded to a 2400-pixel longest edge before subsequent processing; native OpenCV decoding uses power-of-two sampling and Clean color uses row-sized buffers to reduce peak memory. This is stability hardening, not proof of the user's exact Metro restart cause without a matching crash trace.
