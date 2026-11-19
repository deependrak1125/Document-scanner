# Verification — 4 November 2026

## Current source

- `npm run typecheck`: passed across all workspaces.
- `npm run lint`: passed.
- `npm test`: **27 passed**, five test files. Includes real temporary MongoDB, SQLite and filesystem tests, PDF byte checks, and mocked native scanner boundaries. The new regression verifies that upload completion preserves a concurrent local edit and leaves it pending for another upload.
- `npm run build`: API and admin production bundles passed. The admin chart now loads separately: initial JavaScript is 238 KB, with a 366 KB chart chunk. No oversized-chunk warning.
- From `apps/mobile`, `npx expo export --platform android --output-dir dist-android`: passed, 1,997 modules. This verifies JavaScript bundling, not native compilation or device behavior.

## Fixes verified in this pass

- Keep navigation mounted behind the app-lock modal so backgrounding during a scan does not discard the active screen.
- Prevent overlapping automatic-sync retry scheduling on network events. Acquire the sync lock before the asynchronous connectivity check; regression-tested for overlap and release after failure.
- Keep camera focus and foreground state separate so resuming the app cannot reactivate an offscreen camera.
- Load the admin registration chart lazily to remove the oversized initial bundle warning.
- Apply upload acknowledgements transactionally to the latest stored document, preserving edits made during a transfer and clearing only the acknowledged outbox revision.

## Android build — passed

The current native ARM64 Android debug build passed in 3 minutes 9 seconds (715 tasks), including Vision Camera, billing, OCR, PDF and the local image-processing module. Command: `./gradlew :app:assembleDebug --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a`.

Artifact: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (163,857,455 bytes). ZIP integrity passed, ten DEX files are present, ARM64 is the packaged architecture, and Android `apksigner verify --verbose` passed with a v2 signature.

SHA-256: `7c2ff2c415e86964d2ce6492bc001e959dd8da622e5372451d90399abffceead`.

This is a development APK that needs Metro (`npm run dev:mobile`), not a standalone store release. No device installation or runtime acceptance is claimed.

Earlier attempts failed with `No space left on device`. Project-local build intermediates were cleaned in the previous pass. At the final retry, available disk space had increased to 24 GB and the build completed. No personal files or shared Gradle caches were deleted by this task.

## Dependency audit

The final audit reports 17 moderate advisories, zero high and zero critical. Remaining findings concern glob/minimatch and dependent Expo/lint tooling. Suggested automatic fixes include incompatible major downgrades, which were not applied. Compatibility-tested dependency updates remain a release requirement. Native dependencies also emit deprecation/unused-parameter warnings; Gradle reports future Gradle 10 incompatibilities.

## Still unverified

Physical-device camera, crop, OCR, app-lock and purchase behavior; iOS compilation (full Xcode unavailable); live cloud/store providers; qpdf container execution; and browser visual QA (computer-use transport unavailable). See FEATURES.md for remaining implementation gaps and TESTING.md for acceptance workflows. Automated checks do not establish production readiness.

## Mobile UI/UX update — 4 November 2026

- Added a consistent forest-green/cream design, clearer heading hierarchy, action cards, selected filter chips, and improved light/dark button contrast.
- Redesigned Home, library and scanner. Library includes loading/error/retry states, refresh, contextual search/favorites/trash/folder empty states and request ordering that prevents stale results replacing newer searches.
- Added unsaved-scan replacement confirmation across scan, gallery import and document editing; active drafts can be resumed from Scan. Drafts remain in memory until saved.
- Grouped PDF tools into Pages, Watermark and Cloud; cloud actions require a selected file, sign-in, consent and a password where applicable. Editing/signature sections collapse to reduce screen clutter.
- Improved login keyboard handling, account theme selection, document error recovery, safe areas and camera control contrast. Buttons reject duplicate presses while processing.
- Mobile TypeScript and ESLint passed. All 27 existing regression tests passed after the main changes. No physical-device visual or touch acceptance was performed in this pass; no Android emulator surface was available in the computer-use inventory. Native/provider/device release gates in FEATURES.md still apply.

## Filters, translation and tools update — 4 November 2026

- Fixed destructive filter chaining: presets now render from a separately persisted unfiltered crop/rotation base. Switching from B&W back to color, crop-then-preset, adjustment retention and saved-base persistence have regression coverage.
- Added Clean color, Soften and Sharpen; eight presets total. Clean color applies a shared luminance gain to RGB channels. Two Kotlin tests verify white-paper gain, dark ink, red/blue separation and pale-color retention.
- Added ML Kit native English/Hindi translation, first-use Wi-Fi model download, automatic OCR when input is empty, editable translated output, copy/TXT and reflowed PDF export. Fixed missing regenerator runtime in Devanagari font shaping; generated Hindi/English PDF fixture was rendered with Poppler and visually checked.
- Added 18 searchable tool actions, including imported-PDF rasterization into the filter editor, page removal, local JPG export and local lossy image compression. Exact supported/unsupported features are in PDF-TOOLS.md.
- `npm test`: 35 passed in seven files. Workspace type checking and mobile/shared/tests ESLint passed. `:folio-image:testDebugUnitTest`: 2 passed, no errors. Current ARM64 debug native build passed.
- No Android device was connected (`adb devices` returned no devices). Native translation/model-download and real-photo appearance remain device acceptance tasks. Translation unit tests mock the native boundary; they do not certify linguistic accuracy.

Standalone ARM64 test APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Release build passed in 4m42s; APK signature and ZIP integrity passed; `assets/index.android.bundle` is present. Uses the existing development signing key, not store signing. SHA-256: `092879239be242feee5fffebb805441a23f174918461aa9355461a4853d40451`. Metro is not required; configured localhost API/cloud endpoints still need a reachable development server for account/cloud operations.

## Preview controls and categorized tools — 4 November 2026

- Replaced text-only filter choices with actual native-processed thumbnail previews. Added compact icon controls and a fixed safe-area Save footer; saving locks competing edits and reports the failing storage stage without discarding the draft.
- Added a blue/slate shared palette and coordinated home styling. Tools now use six category sections and a two-column icon grid with search; 19 connected actions include OCR-backed Markdown export.
- Added signature drag/resize on raster page previews with crop-box and rotation-aware PDF coordinates. Fixed gesture responder lifetime in crop and signature drawing, excluded the drawing border from signature output, and made saved signature filenames unique to avoid stale image caching.
- Connected the previously missing document-to-translation OCR callback. Added OCR progress/empty-result feedback, guarded overlapping OCR jobs, and added feedback when machine translation returns unchanged text.
- `npm test`: 44 passed in nine files. An earlier API run timed out against the temporary local MongoDB; the clean repeat passed all tests. Workspace TypeScript and mobile/shared/tests ESLint passed.
- Standalone ARM64 APK build passed in 24 seconds. ZIP integrity and APK v2 signature verified. Size 113,071,051 bytes. SHA-256 `3cecf9bcb97c67674f96a3428aa3303dfaef01b0e5e65dd05a6f2cda74ecf216`.
- APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Development signing, bundled JS, no Metro needed.
- `adb devices` found no connected device. The user's unspecified PDF-save failure is not reproduced; storage tests and better failure diagnostics do not certify that device-specific issue as fixed. Gesture/visual acceptance, native OCR quality and translation-model download still need a device check. Unsupported advanced PDF operations remain listed in PDF-TOOLS.md.

## All mobile screens UI pass — 4 November 2026

- Unified typography, spacing, icon badges and section headings across Home, library, Scan, Tools, Settings, login, subscription, document details, editor, manual camera, onboarding and lock screen.
- Added persistent field labels, focused input outlines, search clear controls and password visibility toggle. Content uses a centered maximum width on tablets; onboarding scrolls on smaller displays; crop canvas measures its actual available width.
- Home has paired import tiles, library cards have bounded filenames and press feedback, and tab selection has a visible background. Tools category headers have icons and category-specific empty-search feedback.
- Document details lead with the document title and preview, with rename behind a disclosure and compact icon actions. Editor fine adjustments and page/paper controls collapse independently. Settings groups have clear icon headers; unavailable paid plans show a useful free-plan screen. Manual camera has a framing guide and clearer review controls.
- Workspace TypeScript and mobile ESLint passed. UI-only changes did not add implementation-mirroring tests. Standalone ARM64 Android build passed in 30 seconds; ZIP integrity and APK signing verified.
- APK SHA-256: `54d9513f19e6c677f6448fa89d0cacc37d6693e24079b2bfe2ea630c95342eff`. Path: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`; existing development signing; Metro not required.
- This pass does not claim physical-device visual/touch acceptance or iOS compilation. Functional limitations in PDF-TOOLS.md remain unchanged.

## Workflow improvements — 4 November 2026

- Added session undo/redo for scan edits, page changes and OCR; history is bounded to 20 snapshots and cleared when a draft is saved/discarded. Removing the last page is recoverable. Draft/history remain in memory, not durable storage.
- Added all-page filter application with progress and atomic draft replacement, next/previous page reordering, copied OCR text, and Save & Share with a saved-document fallback when sharing fails. Fine adjustments and paper controls are collapsible.
- Added a dedicated merge route: choose/add/remove files, move files earlier/later, set an output name, review order and merge. Limits: 20 input files, 30 MB per picker file, 60 MB aggregate (checked again from actual bytes before merging).
- Added a safe-area document actions sheet from the library/Home: long press or ellipsis to Share, Favorite, Trash or Restore. Trash requires confirmation; parent lists refresh after changes. Corrected misleading remove-pages instructions and added a startup loading indicator.
- All 48 tests passed in 10 files, including four new history regression tests. Workspace TypeScript and mobile/tests ESLint passed. Android ARM64 standalone build passed in 24 seconds; ZIP integrity and signing verified.
- APK SHA-256: `71e06a3f71f3b746297dc7653859893336ca1fcef14eeb4f14bbd7fcd1889d2a`. Same release output path and development signing as above. Physical-device visual/touch acceptance remains pending.

## Emulator OCR and save regression — 5 November 2026

- Installed the standalone ARM64 release on the isolated `Pixel_9_Pro` Android emulator (`emulator-5556`) and replayed the previously failing path: open a saved PDF, enter Filters & crop pages, apply the native Clean color filter, expand Recognize text, run English OCR, and save the result.
- Fixed the native OCR failure. The bundled ML Kit bridge now decodes app-cache images into a safe ARGB bitmap instead of relying on the Android 15 Exif/file URI reader. Release R8 keep rules preserve ML Kit component discovery and telemetry classes. OCR returned `Folio form test`, `Folio Text f`, and `Hindi` in the editor and no longer showed `Failed to load image`.
- Save PDF completed after OCR and opened a new one-page `Scan 11/5/2026` document (0.06 MB) with the filtered page rendered correctly. The saved PDF screen and source content were visually checked in the emulator.
- Drew a test signature, saved it, dragged the signature box to a new position, and saved a new annotated PDF. The resulting `Scan 11/5/2026 annotated` document (0.07 MB) rendered the signature on the page.
- Added `apps/mobile/plugins/withMlkitOcrFix.cjs` and registered it in `app.json` so fresh Expo prebuilds apply the native and R8 fix to `rn-mlkit-ocr` automatically.
- `npm run typecheck`: passed. Mobile/shared/API ESLint: passed. `TEST_OFFICE_CONVERSION=1 npm test`: **56 passed in 12 files**. Release APK build: passed.
- Release artifact: [Folio-ocr-fixed-release.apk](../Folio-ocr-fixed-release.apk). SHA-256: `3198120238d55ebd0266749ec94dc6a8ef9e79d64bd5484e4c540361102a0926`. The APK uses the existing development signing key and does not require Metro; API/cloud operations still need their configured server.

Still unverified: physical camera quality, iOS compilation, live cloud/provider operations, translation model accuracy, and store signing. Unsupported advanced operations remain listed in PDF-TOOLS.md.

## Native PDF import, previews and editor — 5 November 2026

- The reported screenshots came from Expo Go, which cannot load Folio's image-processing module, ML Kit OCR or PDF viewer. Expo Go now shows a clear install-development-build message instead of exposing native actions that fail. `docs/SETUP.md` gives the native build commands.
- Android PDF picking now copies the selected provider `content://` URI into app-owned cache while its read grant is active. This replaces reading the picker temporary file directly, which produced the reported missing-READ-permission error.
- The editor places rendered filter thumbnails directly below the page preview, with compact page controls and a sticky Save footer. A tap opens a full-screen preview with original/edited comparison and zoom controls.
- Installed the final standalone ARM64 APK on the isolated `Pixel_9_Pro` emulator (`emulator-5556`). Imported a PDF from Android Downloads, saw the PDF viewer render its colored text, applied Clean color and saved a new PDF, merged two picked PDFs into a two-page document, and extracted English OCR text from both merged pages. The final editor build rendered its preview and filter thumbnails on the first screen; full-screen preview rendered the page and its zoom control changed from 100% to 150%.
- `npm run typecheck` and `npm run lint` passed. `npm test`: 54 passed, three skipped in 13 files. Final release build, ZIP integrity and APK v2 signature passed.
- This initial APK was superseded by the scanner fix below. Its SHA-256 was `5807538fe7cdc99276dfc5647e9f25f1e416834942230414f80ce7552af6b835`. The standalone APK bundles JavaScript and needs no Metro; it uses the existing development signing key, not Play Store signing.

Physical-phone and iOS verification, translation model accuracy, live cloud operations and advanced PDF features remain outside this emulator acceptance. See `PDF-TOOLS.md` for feature limits.

## Missing DocumentScanner TurboModule — 5 November 2026

- Replaced the scanner package's enforcing JS import with a non-throwing `TurboModuleRegistry.get("DocumentScanner")` lookup. When the module is missing from an older development binary, capture uses the system camera and sends the photo through the same page editor. When native scanning rejects, the system camera is also used. Native scanner cancellation still leaves the draft unchanged.
- Installed the new standalone ARM64 APK on the isolated Android emulator. `Open scanner` launched Google's document scanner, captured a page and returned to Folio's review editor with its preview. A transient Google scanner error appeared on first launch; after dismissing it, the scanner opened normally. The missing-module fallback is covered by an automated regression test, not a separate binary without the module.
- `npm run typecheck`, `npm run lint` and `npm test` passed; 56 tests passed, three skipped across 13 files. Release build, ZIP integrity and APK v2 signature passed.
- This scanner-fallback APK was superseded by the automatic-scanning build below. Its SHA-256 was `2aa681f1aab2ee9010254d2f000ac046dfd4b6c38e63895699e466e8f29b3345`.

## Automatic scanning restored — 5 November 2026

- Removed the silent system camera fallback that turned `Open scanner` into a plain photo upload when an older binary lacked `DocumentScanner`. The app now explains that the native scanner is missing and offers Folio camera explicitly. A native scanner rejection gets the same choice; a user cancellation leaves the draft alone.
- Native document scans receive Clean color by default (except ID cards), retaining the enhanced scanner image as the editable original. Folio camera's Auto enhance mode detects page corners after capture, crops when corners are found and applies Clean color; the manual camera mode remains available.
- On the isolated Android emulator, `Open scanner` launched Google's scanner with `Auto capture`; it detected and captured the sample page, showed crop/enhancement controls, then returned to Folio's editor with Clean color selected. The page saved as a 0.04 MB PDF and rendered in the document view. The Folio camera Auto enhance mode also captured an image and showed Clean color in the editor. Missing-native-module behavior is regression-tested, not reproduced with a separate old binary.
- `npm run typecheck`, `npm run lint` and `npm test` passed: 58 tests passed, three skipped across 13 files. Standalone ARM64 release build, ZIP integrity and APK v2 signature passed.
- Current test APK: [Folio-native-verified.apk](../Folio-native-verified.apk), 113,267,447 bytes, SHA-256 `f3db062a32672bd2caad631907cd507c0b4479f586dde8458d472ddbba5d4eca`. It uses the existing development signing key and bundles JavaScript, so Metro is unnecessary. Physical-phone camera behavior remains unverified.

## Android development launcher — 5 November 2026

- Added root `npm run android` (`npm run start:android` alias). The launcher uses the mobile workspace, selects installed JDK 17 on macOS and resolves the Android SDK before invoking Expo's native build/install command.
- Executed `npm run android -- --device emulator-5556`: debug build succeeded in 16 seconds, installed on Pixel_9_Pro and connected to the existing mobile Metro server. Verified Folio Home, then opened the native scanner with Auto capture controls. No missing-DocumentScanner error appeared in this run.
- Launcher ESLint and `git diff --check` passed. This verifies local emulator startup, not every application feature or the user's physical phone.

## Expo Go runtime guard — 5 November 2026

- User confirmed the plain-camera report was from Expo Go. Replaced the deprecated `appOwnership`-only gate with Expo's native `isRunningInExpoGo()` probe and `executionEnvironment` check. Added a scanner-entry guard before camera permissions/native lookup. Expo Go now receives native-install instructions rather than reaching the camera fallback through this entry.
- Added coverage for null app ownership, store-client detection, development/standalone builds and blocked capture in Expo Go. TypeScript, ESLint and all 63 tests passed (three skipped). No Android device was connected during this pass, so the new guard was not visually verified in Expo Go. The existing native APK and earlier native scanner verification remain separate from this source guard change.

## 2026-11-05: Profile, PDF preview and signature UX

Current `Folio-native-verified.apk` supersedes earlier hashes in this document.
SHA-256: `3dd8e622b68ab5a25a89f84984a8f7ca970f1d4d70f3ece0b4e454d71ceb3b47`.

- Mobile typecheck and repository ESLint passed.
- Regression suite: 14 files passed; 65 tests passed, 3 skipped. Temporary MongoDB server required running tests outside the filesystem/network sandbox.
- Release arm64 build succeeded; APK archive and signature verification passed.
- Isolated Pixel 9 Pro emulator: Profile and local storage statistics rendered; existing two-page PDF rendered; signature drawing, moving, proportional resizing and saving a new signed PDF verified. Drag bounds changed from `[193,1772][667,1981]` to `[485,1363][959,1572]`, demonstrating touch movement. Resize increased width from 474 to 747 pixels. Saved output visibly contains the drawn mark.
- Adjusted signature preview to the measured workspace height after discovering controls below the visible viewport; rechecked all controls fit above the save bar.
- Final APK installed and selected a Downloads PDF in Organize pages; source preview and full-screen preview rendered.
- Screenshots: `screenshots/android-profile.png`, `screenshots/android-signature-workspace.png`, `screenshots/android-signed-pdf.png`, `screenshots/android-fullscreen-pdf.png`.
- Physical phone not tested. Raster fallback failure/retry is not exhaustively device-tested. Text note placement still uses PDF coordinates; existing PDF text editing is outside the implemented feature set.

## 2026-11-18: Simple Home and explicit phone export

User clarified that PDFs were saved in Folio but absent from Downloads. Added
Android SAF folder export, iOS Files share flow, distinct Save in app / Save to
phone actions, and prominent export/share actions on saved documents. Simplified
Home by removing the promotional banner and statistics above recent documents.

- Mobile typecheck, ESLint and diff whitespace checks passed.
- Export and persistence regression suites: 11 tests passed, including picker
  cancellation, partial-write cleanup, filename sanitization and iOS share routing.
- Release arm64 APK build, APK signature verification and ZIP integrity passed.
- Isolated Pixel 9 Pro emulator: imported a PDF using the system picker, tapped
  Save to phone, created Downloads/Folio, granted folder access, and observed the
  success alert. Pulled the exported file and compared its SHA-256 to the original:
  both `046010fe3e061ed584deb2ddb3d9207cd3c759e3f1a7697bc865f6ac0d8ffe61`.
- Home screenshot visually inspected; screenshots saved as
  `screenshots/android-simple-home.png` and `screenshots/android-phone-export.png`.
- Current `Folio-native-verified.apk` SHA-256 (supersedes earlier artifacts):
  `4bbf134d91ee100891e6fed1dea373ea2441f37b17b5fb3a056455146e2afd19`.
- Physical phone and iOS runtime not tested in this pass.
