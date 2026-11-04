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
