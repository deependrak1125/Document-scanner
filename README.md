# Folio

An original, offline-first document scanner monorepo: React Native mobile app, Express API, and React admin workspace. Real native capture, image processing, OCR, SQLite storage, PDF creation/editing, S3 transfers, and store-verification code are included.

**Status: development implementation, not a production-certified release.** Read [feature coverage and release gates](docs/FEATURES.md) before deploying. Hardware behavior, live cloud providers, and store purchases must be validated on real devices/accounts. Nothing substitutes fake success responses for unavailable providers.

## Start here

Requirements: Node **24.3+ or 26+**, npm, JDK 17, Android SDK for Android; macOS with full Xcode and CocoaPods for iOS. Docker is optional for local infrastructure. Expo Go cannot run these native modules.

```sh
npm ci
cp .env.example .env
# Replace JWT_SECRET with a cryptographically random value.
# Start local MongoDB replica set, Redis, and S3 emulation:
docker compose -f infrastructure/docker/compose.yml up -d
npm run dev:api
# Another terminal:
npm run dev:admin
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` and `VITE_API_URL` in `apps/admin/.env`. On an Android emulator the host API is usually `http://10.0.2.2:4000`; on a physical device use a reachable LAN host or HTTPS deployment. Signed S3 URLs must also be reachable from that device. Local infrastructure binds to loopback deliberately. Use a controlled development tunnel or configure appropriate LAN bindings when testing a phone. Do not expose unauthenticated development databases publicly.

Mobile:

```sh
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
# For subsequent sessions:
npx expo start --dev-client
```

Run all Expo commands **inside `apps/mobile`**. Root commands `npm run dev:mobile`, `npm run dev:api`, and `npm run dev:admin` route to the correct workspace.

Create an admin account directly (prints a generated password once; reruns preserve the existing password):

```sh
npm run seed:admin -w @folio/api -- admin@folio.local
```

Alternatively, create an account using the mobile app, then grant administrative access explicitly:

```sh
npm run admin -w @folio/api -- administrator@example.com
```

There is no default admin password. The admin UI uses real APIs and does not show sample business metrics.

## Architecture

```text
apps/mobile/       Expo Router, native scanner, Vision Camera fallback, OCR, local library
  modules/folio-image/  OpenCV Android / Core Image + Vision iOS; PDF rasterization
apps/admin/        Vite + React + Tailwind, role-protected operational dashboard
services/api/      Express, MongoDB, authentication, S3 transfers, sync, store providers
packages/pdf/      Shared PDF creation and editing, positioned invisible OCR text
packages/shared-types/  Cross-application contracts
packages/validation/    Zod schemas
packages/api-client/    Typed HTTP client
infrastructure/    Local services, API image, HTTPS proxy example
tests/             Real PDF, MongoDB integration, SQLite/filesystem, scanner-adapter tests
docs/              API, setup, privacy, testing, coverage and release gates
```

The native document-scanner SDK owns the live automatic boundary/capture/crop workflow. Vision Camera provides an offline manual camera independent of Google's downloadable scanner component. Manual photographs and gallery imports can use OpenCV (Android) or Vision (iOS) boundary detection and perspective correction in the editor. Image processing runs in native asynchronous code; it changes exported pixels.

PDF editing uses `pdf-lib` for cross-platform offline operations. Searchable copies contain positioned invisible text from ML Kit word boxes and an embedded Noto Sans Devanagari font. Ordinary scan PDFs are explicitly described as image PDFs. Hindi/English OCR models are bundled. Imported PDF OCR rasterizes one page at a time through native PDF APIs.

## Commands and verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run check
npm run format
```

Tests use a temporary MongoDB replica set (first run may download MongoDB) and Node's real SQLite implementation. Cloud object storage calls are mocked in API tests; no live provider verification is implied. Scanner adapter tests simulate native module boundaries; they do not replace physical camera tests. See [TESTING.md](docs/TESTING.md).

Android bundling:

```sh
cd apps/mobile
npx expo export --platform android --output-dir dist-android
```

## Documentation

- [Feature coverage and unfinished work](docs/FEATURES.md)
- [PDF tools, filters and document translation](docs/PDF-TOOLS.md)
- [Android, iOS, deployment and provider setup](docs/SETUP.md)
- [API and synchronization protocol](docs/API.md)
- [Device acceptance tests](docs/TESTING.md)
- [Latest verification results and Android APK](docs/VERIFICATION.md)
- [Privacy policy draft](docs/PRIVACY.md)
- [Architecture and failure recovery](docs/ARCHITECTURE.md)

OpenAPI is served at `/openapi.json`; the source is `services/api/src/openapi.json`. Environment examples are in `.env.example`. Signing keys, provider credentials, and customer documents do not belong in the repository.
# document-scanner
