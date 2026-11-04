# Feature coverage and release gates

“Implemented” below means executable source is connected to the app/API, not that a production certification or physical-device acceptance test has passed. See TESTING.md for actual checks.

## Implemented

Latest additions: a searchable 18-tool hub, imported-PDF filtering, color-preserving white-paper enhancement, reversible presets, local image compression, and on-device Hindi/English document-text translation with TXT/reflowed PDF export. See PDF-TOOLS.md for exact behavior and remaining gaps.


- Expo/TypeScript monorepo, five-tab navigation, light/dark/system theme, guest onboarding and optional login.
- Native multipage document scanner integration with platform-provided automatic boundaries, perspective correction, retake and crop UI. Native SDK auto-capture behavior varies by device/platform.
- Vision Camera manual offline capture, flash control, multipage session and review flow.
- Post-capture OpenCV quadrilateral detection on Android; Vision rectangle detection on iOS. Manual draggable corners, perspective transform, actual grayscale/B&W/color/enhancement/brightness/contrast processing, reset and source comparison.
- Native asynchronous image work; bounded image dimensions and explicit Mat/bitmap cleanup on Android. Core Image processing queue on iOS.
- Sequential multipage PDF creation, A4/Letter/Legal/automatic size, page reordering, page removal, more capture/import, private front/back ID layout.
- SQLite library and transactional metadata/outbox; original/processed scan images in app-private files; atomic temporary PDF rename before metadata publication. Disk failure cleanup.
- Search names/OCR text, grid/list, sorting, flat folders, favorites, rename, duplicate, trash/restore, native sharing/printing, native PDF renderer with page navigation/zoom.
- Offline PDF merge, extraction/split by range, page reordering/deletion, rotation, page numbering, watermark, handwritten image signatures, text notes. Source-preserving exports.
- Native PDF-page rasterization for imported-PDF OCR; bundled ML Kit Latin and Devanagari models; OCR text viewer/copy/TXT export/retry/local search.
- Searchable PDF copies with word-positioned invisible text and embedded Devanagari font. OCR output has no fabricated confidence values.
- Optional biometric/device-credential lock. No separately implemented custom PIN system.
- Email registration/login, Argon2 password hashes, short-lived JWT access tokens, transactional refresh rotation, replay revocation, secure mobile refresh storage, logout and server-side session revocation.
- Google ID-token verification and Twilio Verify OTP API adapters (credentials required).
- Owner-scoped document/folder APIs, revisions, tombstones, cursor pagination, idempotent metadata push and explicit conflict-resolution API.
- S3 signed PUT/GET, declared-size reservations, actual MIME/size/PDF-header validation, immutable verified object copies, encrypted S3 writes, retryable account-deletion queue.
- Opt-in foreground sync, network-aware retries, local outbox, account-bound transfers, conflict detection, signed uploads, cloud PDF restore. Sensitive ID scans are excluded.
- Store-native subscription purchase/restore screen, disabled by default until configured. Server Google Play API validation; Apple signed-transaction verification plus App Store Server API lookup. Purchases are tied to the signed-in account and acknowledged only after backend verification.
- Free/premium storage quotas, unique store transaction binding, entitlement expiration cleanup, configurable product IDs.
- Independent admin login, overview, account search/suspension, storage/subscription metadata, live registration chart, upload/database status. Private document content is not exposed in the dashboard.
- Validation, bounded requests, security headers, origin restriction, process-level rate limits, structured metadata-only logging, role checks and admin audit records.
- Explicit-consent cloud PDF tools: qpdf compression/encryption/decryption, Poppler text extraction/page-to-PNG, bounded concurrent jobs and temporary-file cleanup.
- API documentation, infrastructure files, provider configuration examples, automated tests, platform build configuration.

## Partial or deliberately bounded

- The primary live automatic scanner uses the native scanner SDK, not a custom Vision Camera frame processor. OpenCV detection in the manual path occurs after capture. No invented live bounding-box overlay.
- Native scanner outputs are the preserved source images; raw pre-crop camera frames are not available from that SDK. Manual-camera originals are preserved before crop.
- Page order uses accessible buttons, not drag-and-drop. No per-page rescan replacement button; remove and recapture provides the workflow.
- Editor has presets and incremental brightness/contrast controls, not a full slider-based nondestructive edit-history stack. iOS B&W uses Core Image thresholding; Android uses adaptive Gaussian thresholding. Shadow cleanup differs by platform.
- Offline PDF operations are in-memory and limited to modest files. Imports for tools are capped at 30 MB; scan creation is capped at 100 pages; imported-PDF OCR at 50 pages. This is not a streaming large-PDF editor.
- Signatures support drawing, color, local reuse, numerical position/size/rotation and export to a new copy. A drag-to-place canvas and freehand/highlight/shape/underline annotations are still missing.
- PDF viewer does not yet offer a text-search overlay or thumbnail rail. Recognized text is searchable in the document library and exported searchable copies are searchable in external PDF readers.
- Cloud sync currently transfers the final PDF and basic metadata. Source images, per-page edit state, OCR metadata and folder organization are not backed up; restored PDFs can run OCR again. Nested folders are not implemented.
- Foreground automatic retry is implemented; OS-scheduled background execution and true multipart resumable uploads are not. Interrupted uploads retry in full with a new signed transfer. Conflicts offer “keep local”; “keep both” requires duplicating first. Full folder-conflict convergence remains work.
- Google/OTP backend adapters are implemented; mobile Google sign-in and phone-entry screens are not yet connected. Email/guest flows are connected.
- Store checkout/restore and validation code exist, but subscriptions are not end-to-end verified. Renewal/refund server notifications and authoritative recurring revalidation are not yet implemented. Do not enable production billing until these are added; local expiry cleanup is insufficient for immediate refund revocation.
- Premium currently expands cloud quota. Additional premium feature gates and cloud priority queues are not implemented.
- Admin metrics cover actual data available in MongoDB. Revenue is intentionally `null`; paid revenue ingestion, request latency/error charts, job inspection UI and audit-log UI are still missing.
- Public API pagination is bounded; local search scans SQLite metadata rather than full-text virtual tables. Folder list cap is 500.
- Local filesystem protection uses the OS app sandbox/device protection; per-document encryption and secure deletion of forensic remnants are not implemented.
- UI localization, help/support integration, thumbnail cache eviction, advanced storage management and independently validated accessibility/performance budgets remain unfinished.

## External configuration / validation blockers

- Full Xcode is absent on the implementation host; iOS native code is not compiled or device-tested here.
- No real camera device was used for quality, autofocus, lighting, blur/auto-capture, Hindi OCR accuracy, memory-pressure or background-resume tests.
- Google Play / App Store products, signing identities, sandbox testers, Apple root certificates/API key and Google service account must be supplied by the operator.
- Cloud S3, Redis queues, provider OTP/Google login and multi-device synchronization require integration tests against configured services. Docker was not installed on the implementation host.
- qpdf was unavailable on the host. Its worker implementation requires the provided API container or a local qpdf installation; cloud tool commands need fixture/security testing in that environment.
- Computer-use/browser transport was unavailable, so visual browser QA could not be completed.
- Remaining moderate transitive dependency advisories in Expo/lint glob matching must be evaluated and resolved before a production release. Do not blindly apply the audit tool's suggested Expo downgrade.

The product is not yet at the complete Kaagaz-comparable acceptance bar. In particular, store lifecycle notifications, full synchronization fidelity, annotation UX, physical-device QA and iOS compilation are release gates, not claimed completed features.
