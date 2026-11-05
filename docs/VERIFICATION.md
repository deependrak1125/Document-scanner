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
