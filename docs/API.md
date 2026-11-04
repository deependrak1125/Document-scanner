# API and synchronization

Base path `/api/v1`; OpenAPI at `/openapi.json`. Source: `services/api/src/openapi.json`. The OpenAPI document lists routes and common schemas; this file supplies lifecycle details. Errors use `{ "error": { "message": "...", "details": ... } }`. Normal validation failures return 400, authentication 401, role denial 403, absent/unowned resources 404, revision collisions 409, quota exceeded 413, invalid files/purchases 422 and unavailable providers 503.

## Sessions

`POST /auth/register` takes `{name,email,password}`; `POST /auth/login` takes `{email,password}`. Passwords require 12–128 characters. Responses include `user`, `accessToken` and `refreshToken`. Send `Authorization: Bearer <accessToken>` for protected requests. The access token expires in 15 minutes. Store the refresh token in secure device storage; `/auth/refresh` consumes it once and returns a replacement. Replaying an old refresh token revokes that family. `/auth/logout` revokes the current session.

Additional routes: `/auth/google` (verified ID token), `/auth/otp/request` (`phone` in E.164), `/auth/otp/verify` (`phone,code`), `/auth/me`, `/auth/sessions`, `/auth/export`, and `DELETE /auth/account`. Account deletion returns 202 only when the Redis-backed deletion job is accepted. The account is disabled while object and metadata cleanup is retried. The admin web app deliberately retains only an in-memory short-lived access token.

## Document writes

Create with `{id:<UUID>,title,pageCount,favorite?,folderId?}`. IDs are client-generated, but ownership is always assigned from authentication. Create is idempotent for the same owner's UUID. A foreign owner's UUID is rejected. Patch accepts an allowlist of metadata plus the **expected** `revision`. Successful mutations increment revision. Delete and restore take `{revision}`; delete creates a tombstone, rather than removing sync history. List returns `{items,limit,offset}` and excludes trash. Cloud duplicate copies the object, accounts quota and creates a new UUID; it rejects sources without an uploaded file.

Folder APIs support flat folders. Deleting a folder unfiles its documents and increments their revisions. Folder ownership is verified on document writes.

## Transfer lifecycle

1. Create document metadata and record the returned revision.
2. `POST /uploads/initiate` with `{documentId,fileSize,mimeType:"application/pdf",revision}`.
3. The API reserves quota transactionally and returns `{uploadId,url,headers,expiresIn}`. PUT the raw bytes to `url` with returned headers. The signed URL lasts 15 minutes; the upload reservation lasts one hour.
4. `POST /uploads/complete` with `{uploadId}`. The API checks actual object size/type/header, conditionally copies that exact ETag to an immutable verified key, commits document revision/quota and removes staging data. Completion is idempotent.
5. On failure call `/uploads/abort` with `{uploadId}`; cleanup also expires abandoned reservations. Never delete the local source because upload fails.
6. `GET /documents/:id/download` returns a short-lived signed GET URL for an owned cloud file.

Single PUT transfers retry from the beginning. Multipart resumability is not implemented. Files are not stored in MongoDB. Deployment lifecycle policies should clean abandoned staging/orphan objects; verify cleanup behavior against your S3-compatible implementation.

## Sync protocol

`GET /sync/changes?cursor=<opaque>&limit=50` returns `{items,cursor,hasMore}` sorted by server `updatedAt,id`, including tombstones. Preserve the opaque cursor only after applying the batch. `POST /sync/push` takes `{key:<UUID>,id:<document UUID>,patch:{revision,...metadata}}`. An idempotency key binds to the complete request hash; reusing it with another body is rejected. Successful replay returns the original result without a second revision increment.

`POST /sync/conflicts/resolve` takes `{id,patch:{revision,...metadata}}`; the supplied revision must match the latest remote document. Mobile “keep local” first adopts the latest remote revision then queues the local file. Duplicate locally first to keep both versions. Upload acknowledgements update only synchronization fields, retaining concurrent local edits and their queued revision.

The mobile worker runs only after explicit backup opt-in and account authentication, excludes sensitive ID scans, stops when account/backup settings change, and retries foreground/network failures with exponential backoff. It uploads final PDFs/basic metadata, not original images or folder/OCR state. Timestamp cursor semantics are suitable for this development implementation; production multi-writer deployments should adopt a transactional immutable change journal or a monotonic server sequence to eliminate clock/coincident-update edge cases.

## Store subscriptions

`GET /subscriptions/plans` is public. `/subscriptions/current` reports a currently active unexpired entitlement. `/subscriptions/verify` and `/subscriptions/restore` take `{platform:"android"|"ios",productId,purchaseToken}`. A client success flag has no effect. The API verifies the store and account binding and uniquely claims the transaction. No configured provider returns 503, never a fabricated premium entitlement.

## Administration

Every `/admin/*` route requires a currently active admin user/session. Overview, users, document statistics, subscriptions, registrations and system health return operational metadata. `PATCH /admin/users/:id` takes `{accountStatus:"active"|"suspended"}`; suspension revokes sessions and records an audit entry. Self-suspension is rejected. List endpoints bound page sizes. Default admin APIs do not return PDF content or document titles.

## Explicit cloud tools

`POST /pdf/process`, raw `application/pdf` bytes (maximum 30 MB), with:

- `X-Folio-Consent: upload-for-processing`
- `X-Folio-Options: {"operation":"compress"}` (a JSON string)

Operations: `compress`, `encrypt`, `decrypt`, `text`, `image`. Encryption/decryption additionally require `password`; image uses one-based `page`. Output is PDF, UTF-8 TXT or PNG respectively. Text extraction reads existing text, not OCR. Password-protected PDFs are shared directly after encryption because the local `pdf-lib` metadata importer cannot reopen encrypted PDFs.
