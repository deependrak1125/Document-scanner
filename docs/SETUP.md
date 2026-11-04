# Platform and service setup

## Local services

Run the root README commands. MongoDB must be a replica set because quota, refresh, audit and sync operations use transactions. The supplied development Compose file bootstraps a single-node replica set, Redis, and a LocalStack S3 bucket with AES256 encryption. `directConnection=true` in the host development Mongo URI avoids Docker-hostname discovery problems. Production requires authenticated MongoDB, encrypted connections and backups; do not reuse the unsecured local database configuration.

Set a random `JWT_SECRET` of at least 32 characters. Never put this value or provider secrets in `EXPO_PUBLIC_*`/`VITE_*` variables: those are embedded in client bundles. `.env.example` is a template, not production credentials. `S3_ACCESS_KEY=test` and `S3_SECRET_KEY=test` apply only to LocalStack.

For AWS S3, omit `S3_ENDPOINT`, use workload IAM credentials or restricted S3 credentials, enable block-public-access and default encryption. Allow only the application bucket. Add lifecycle cleanup for abandoned staging objects; keep verified document files until explicit account deletion. A compatible provider must support conditional server-side copy, encrypted writes and signed PUT/GET. The signed endpoint must be reachable by the phone as well as the API. Clients supply returned signed headers exactly.

`npm run dev:api` reads the root `.env`. Mobile and admin read their own workspace `.env` files. Keep Android development traffic local; use HTTPS for deployed services.

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
