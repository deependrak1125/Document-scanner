# Platform and service setup

From the project root, run `npm run android` to build, install and open the native
Android app. On macOS the launcher selects JDK 17 and the standard Android SDK
automatically. Use `npm run android -- --device` to select a device. `npm start`
starts only Metro for an already-installed development build.

## Local services

Run the root README commands. MongoDB must be a replica set because quota, refresh, audit and sync operations use transactions. The supplied development Compose file bootstraps a single-node replica set, Redis, and a LocalStack S3 bucket with AES256 encryption. `directConnection=true` in the host development Mongo URI avoids Docker-hostname discovery problems. Production requires authenticated MongoDB, encrypted connections and backups; do not reuse the unsecured local database configuration.

Set a random `JWT_SECRET` of at least 32 characters. Never put this value or provider secrets in `EXPO_PUBLIC_*`/`VITE_*` variables: those are embedded in client bundles. `.env.example` is a template, not production credentials. `S3_ACCESS_KEY=test` and `S3_SECRET_KEY=test` apply only to LocalStack.

For AWS S3, omit `S3_ENDPOINT`, use workload IAM credentials or restricted S3 credentials, enable block-public-access and default encryption. Allow only the application bucket. Add lifecycle cleanup for abandoned staging objects; keep verified document files until explicit account deletion. A compatible provider must support conditional server-side copy, encrypted writes and signed PUT/GET. The signed endpoint must be reachable by the phone as well as the API. Clients supply returned signed headers exactly.

`npm run dev:api` reads the root `.env`. Mobile and admin read their own workspace `.env` files. Keep Android development traffic local; use HTTPS for deployed services.

Start the mobile Metro server from the workspace root with `npm start` (or
`npm run dev:mobile`). The equivalent direct command must be run inside the
mobile workspace:

```sh
cd apps/mobile
npx expo start --dev-client
```

For the full native scanner/OCR/PDF experience, build and install the
development client in a second terminal:

```sh
cd apps/mobile
npx expo run:android
```

Then keep Metro running with `npm start` from the workspace root. Open the
**Folio** app icon after installation. Scanning the QR code with Expo Go opens
a different Android app that does not contain Folio's PDF preview, OpenCV
filters, camera and OCR modules. Folio displays a setup notice there instead
of offering controls that cannot work.

If `DocumentScanner could not be found` appears or `Open scanner` says the
automatic scanner is unavailable, reinstall the latest Folio native APK or
rebuild with `npx expo run:android`. A Metro reload cannot add missing native
modules to an older app installation. The automatic scanner detects/crops pages
while capturing; Folio camera is an explicit alternative that detects/crops
after a shutter tap and applies Clean color.

Running `npx expo start` from the workspace root makes Expo look for a root
`App.tsx`/`App.js`, which is not the Folio app and causes an `Unable to resolve
"../../App"` error. Expo Go also cannot load Folio's native camera, OCR and PDF
modules; use the Folio development APK or standalone release APK for those
features. A standalone release APK runs without Metro.

## Android

Install JDK 17 and Android SDK/build tools matching Expo's generated configuration. The checked dependency combination uses Expo 58, React Native 0.88.1, and React 19.3.0. `package-lock.json` locks exact resolved versions.

```sh
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
```

A reproducible local native compilation (macOS example):

```sh
cd apps/mobile/android
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :app:assembleDebug --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
```

The generated debug APK is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. It needs Metro (`npm run dev:mobile`). The ARM64 build targets physical ARM64 phones and ARM64 emulators, not x86 emulators.

Standalone internal preview with EAS:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Production: configure your owned package ID, app icons, versioning, EAS project and Google Play signing, then `npx eas-cli build --platform android --profile production`. Do not upload a development-signed APK to production. Verify 16 KB page-size support of every bundled native dependency and run the device acceptance checklist before publication.

Native scanner: Android's Google document-scanner component may download on first launch. The Vision Camera manual path works without that component and provides post-capture OpenCV/manual cropping. ML Kit Latin/Devanagari OCR models are configured as bundled models. Test cold offline installation, not only warm offline reuse.

## iOS

Full Xcode is required (Command Line Tools alone are insufficient). Configure your Apple team and an owned bundle ID, then:

```sh
cd apps/mobile
npx expo prebuild --platform ios
npx expo run:ios --device
```

Use a physical iPhone for camera/ML Kit testing. ML Kit may impose simulator architecture constraints; do not work around these by weakening device verification. Native app code uses VisionKit, Vision rectangle detection, Core Image processing and Core Graphics PDF rasterization. The implementation host did not have full Xcode, so iOS compilation remains unverified.

For distribution, configure App Store Connect, privacy declarations, camera/photo/Face ID descriptions, icons and signing; use the EAS production profile.

## Optional authentication providers

- Google: configure the OAuth web client audience in `GOOGLE_CLIENT_ID`. `/auth/google` accepts and verifies an ID token. Linking an existing email account is intentionally rejected until a dedicated authenticated linking flow is implemented. The mobile Google sign-in screen is not yet connected.
- OTP: configure Twilio account SID, auth token and Verify service SID. Request/verify endpoints invoke Twilio Verify. Codes are not accepted locally or logged. The mobile OTP entry screen is not yet connected.
- Email/guest flows are connected and do not require either provider.

## Store billing

Billing defaults to disabled (`EXPO_PUBLIC_BILLING_ENABLED=false`). Do not enable real billing merely because source compilation succeeds.

1. Create the matching subscription product IDs in Google Play/App Store Connect; set `PREMIUM_PRODUCT_IDS` on the API.
2. Google: set `GOOGLE_PACKAGE_NAME` and a Play Developer API service account JSON in `GOOGLE_SERVICE_ACCOUNT`. Grant the minimum purchase-management permissions. Internal-track install and license-test accounts are required for genuine testing.
3. Apple: configure key ID, issuer ID, bundle ID, numeric app Apple ID, base64-encoded private P8 key, and operator-provisioned Apple root CA certificate paths. Obtain roots from Apple's PKI site. `APPLE_ENVIRONMENT=Sandbox` is allowed only outside production; production refuses sandbox authorization.
4. The app submits native purchase tokens/JWS to the API. Google purchases must carry the user's obfuscated account ID; Apple transactions must match the user's app-account UUID. The backend checks signatures/provider status, product, ownership and expiry. Only then does the client finish/acknowledge the transaction.
5. Implement authenticated Google RTDN and Apple server notifications with replay protection and recurring provider checks before launch. Current expiry cleanup and manual restore do not immediately detect every refund/revocation.
6. Complete sandbox purchase, interrupted verification, restore, cancellation, refund and cross-account rejection tests. Then enable the build flag for testing.

## Cloud PDF tools

The API image installs `qpdf` and `poppler-utils`. These explicit-consent operations require a signed-in user, `application/pdf`, the consent header and a bounded options header. They do not run on guest documents automatically. The server uses temporary private directories, fixed executable arguments (no shell interpolation), a 60-second process timeout and a two-operation concurrency cap. Encryption passwords are in a mode-0600 temporary job file, not process arguments.

Use a dedicated, resource-limited container for untrusted PDF processing before production. Keep qpdf/Poppler patched, apply CPU/memory/process limits and restricted network/credentials. The provided in-process concurrency gate is per API instance, not a distributed job quota.

## Deployment

```sh
npm run check
docker build -f infrastructure/docker/Dockerfile.api -t folio-api .
```

Supply runtime secrets via your secret manager. Deploy behind HTTPS (example `infrastructure/deployment/Caddyfile`). Build and serve `apps/admin/dist` with SPA fallback. Limit `ADMIN_ORIGIN` to the deployed dashboard. Configure proxy identity/rate limits intentionally; the API does not blindly trust forwarded IP headers. For multiple replicas, move rate limits to a shared Redis store and move PDF processing to isolated workers.

Back up MongoDB and the object bucket; rehearse restore. Configure object lifecycle retention and monitoring for failed deletion jobs. Local mobile files must remain intact even when cloud operations fail. No deployment or store publication was performed by this implementation.

### Save a PDF to Downloads / Files

**Save in app** keeps the PDF in Folio's private library. To create a copy visible
in your phone's file manager, use **Save to phone** on the review or document
screen. On Android, choose a folder in the system picker, then tap **Use this
folder** and allow access. Some Android versions disallow the Downloads root;
create/select a subfolder such as `Downloads/Folio` instead. Cancelling the picker
leaves the library copy safe. On iOS, choose **Save to Files** in the share sheet.

### Metro starts with a missing `../../App`

The repository root is not an Expo app. Stop the old Metro process with Ctrl+C.
From the repository root run `npm start -- --clear` (for an already installed
native development build), or `npm run android` to build/install native changes.
Direct Expo CLI commands must run inside `apps/mobile`. Root Expo commands now
stop with these instructions instead of selecting Expo's default `AppEntry.js`.

### Google Drive backup on Android

Production Folio runs without a Folio server by default. Users choose a Google
account only to enable backup and restore. Enable Drive API for your Google
Cloud project, configure consent for `drive.file` and `drive.appdata`, and
register an Android OAuth client for `com.foliodocument.app` with the signing
certificate SHA-1. Use the Play app-signing SHA-1 for Play-installed builds.
Register the debug or upload certificate separately for those test builds.

Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to the public Android client ID in
`apps/mobile/.env.production.local` for local releases, or in the EAS production
environment for hosted builds. Google Play services authenticates the package
and certificate and supplies Drive access tokens. There is no Web OAuth client,
client secret, or token exchange server in this flow. Native Android builds are
required. The iOS Drive connection is not configured by an Android OAuth client.

In Profile → Google Drive backup, connect the same Google account on each phone.
Folio checks on connect, app resume and periodically in the foreground. New
backups are visible in My Drive → Folio → Documents. Previous hidden backups remain
readable. Only final regular PDFs up to 30 MB are included. Folder assignments,
OCR metadata and edit history do not travel. Folio local deletion does not delete
Drive backup copies. Drive storage quotas apply.
