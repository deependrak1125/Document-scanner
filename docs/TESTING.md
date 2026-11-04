# Verification and acceptance testing

## Automated checks

`npm run check` runs strict workspace TypeScript, ESLint, Vitest, API bundling and the admin production build. Tests operate on actual PDF bytes, a temporary MongoDB replica set, actual temporary filesystem files and Node SQLite. Native scanner/permission boundaries and S3 are mocked only in tests. These mocks do not exist in production paths.

Covered: PDF generation/reload, multipage ID layout, merge/extract/reorder/rotate, signatures/notes, invisible text operators, bad page ranges, credential validation, password privacy, refresh rotation/replay, ownership, admin denial, revisions, trash/restore, foreign folders, MIME/quota reservations, upload abort, sync cursor pagination/ties, idempotency keys, untrusted payment flags, unconfigured providers, denied/cancelled capture, gallery cancellation, OCR invalidation on rotation, local reload/search/duplicate/restore, full-disk rollback concurrent-edit upload acknowledgements and concurrent sync startup/recovery.

Native compile: run Android Gradle and Metro export as described in SETUP.md. Compilation is not device acceptance. The initial native Android scanner/PDF/OCR build passed; the final current build status is recorded in VERIFICATION.md. iOS needs full Xcode and physical-device tests. Browser visual QA was blocked by unavailable computer-use transport.

## Device matrix

Use at least a budget Android phone (2–4 GB RAM), a current Android phone, and a supported physical iPhone. Test light/dark themes, large fonts, screen reader labels, rotation and small screens. Include Android devices with and without a preinstalled/downloaded Google scanner component.

## Required manual acceptance

1. **Permissions:** fresh install → guest → scan; deny then grant permission. Cancel scanner/gallery/PDF picker. No phantom saved document or crash. Verify camera access is not requested at onboarding. On unsupported native scanner devices use Manual camera.
2. **Scan A:** photograph printed paper on a contrasting background; verify real detected boundary, adjust all four corners, apply perspective correction and a filter, save, reopen, share and inspect exported pixels. Repeat with shadows, skew, low contrast, receipts and landscape pages. Verify reset returns original geometry.
3. **Multipage B:** capture two pages, reorder, rotate/filter one, remove/re-add, save one PDF and confirm page order/content in an independent viewer. Background the app while capture is open, especially with app lock enabled.
4. **OCR C:** scan English and Hindi known text, recognize, compare punctuation/ligatures/word positions, copy/export TXT and search local text. Export a searchable copy and search/select text in an independent reader. Confirm an ordinary scan PDF is not described as searchable. Repeat on an imported PDF; test per-page rasterization/memory bounds.
5. **PDF tools D:** import known PDFs, merge/extract/delete/reorder/rotate/number/watermark; reopen in a separate reader. Draw/reuse/color/place a signature and add a note; verify it is in the exported bytes. Confirm original files are unchanged.
6. **Offline E:** on a cold install disable connectivity; use manual camera and crop, scan English/Hindi, save and force-stop/reopen. Confirm PDFs and OCR survive. Test the primary scanner both before and after its first component download.
7. **Cloud F:** use configured S3/Mongo/Redis. Sign in and opt in, upload, interrupt a transfer, reconnect, retry, restore on a second device. Modify the same document on two devices; preserve local data on 409. Rename while upload runs; the newer local revision must remain pending. Switch accounts/disable backup during sync; no subsequent transfer may proceed under another account.
8. **Private IDs H:** capture both sides, export stacked/side-by-side, inspect layout, opt into backup and confirm no ID object is uploaded. Confirm explicit cloud-tool consent is separate and source PDFs are user-selected.
9. **Store G:** configure sandbox products and credentials; purchase, server-verify, acknowledge and check quota. Retry after network failure between purchase and verification. Restore after reinstall. Test wrong product, other account, fake token, expired subscription, refund and revoked purchase. Production release requires server notification handling beyond the current implementation.
10. **Cloud PDF processing:** in the provided container test valid, malformed, truncated and encrypted fixtures; verify password rejection, compression round-trip, PNG/text output, 30 MB boundary, timeouts, two-job limit and temp cleanup. A process failure must not expose source/password data in logs.
11. **Account/security:** non-admin cannot read admin routes; another account cannot access any file/folder/upload. Suspend an account and verify session revocation. Delete a test account, interrupt object deletion, ensure the retry worker completes and no local-only documents are removed. Inspect logs for sensitive data.
12. **Reliability:** full/low disk, interrupted save, repeated captures, 30-page OCR, 30 MB PDF, app kill, denied biometric authentication, revoke permissions in Settings, long session expiration, and high-latency network. Record peak memory, camera FPS, time per page and recovery behavior; no performance certification is claimed yet.

Record OS/device/build ID, steps, fixture names, actual outcomes and screenshots in your test report. Do not use real identity documents for automated fixtures or analytics.
