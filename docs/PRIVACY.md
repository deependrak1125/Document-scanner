# Folio privacy policy draft

This is an implementation-aligned draft for the eventual operator to complete with their identity, contact address, legal basis, retention schedule, jurisdictions and service providers before publication. It is not a claim of legal compliance.

Folio can scan, edit, recognize text, store and share documents without an account. These operations use device-local files and on-device processing. Camera permission is requested only for scanning. Photo access is used for user-selected imports. Face ID/device authentication is used only when app lock is enabled.

A user who signs in and enables cloud backup authorizes upload of ordinary final PDFs and basic document metadata to the configured service. Foreground backup retries after network failures. ID scans created in the private ID workflow are excluded. Users may disable backup; this does not itself delete already-uploaded cloud files. Explicit cloud PDF tools separately ask for permission to upload the selected complete file for temporary processing.

Account data includes name, email/phone or provider identifiers, password hashes where applicable, sessions, storage usage and subscription verification records. Raw passwords and document contents are not logged for analytics. Operational administrators see account and aggregate service metadata, not document content by default. Cloud infrastructure operators with privileged storage access remain part of the trust boundary; this is not end-to-end encrypted cloud storage.

Cloud objects are written with server-side encryption and shared through expiring signed URLs after authorization. Local documents use the operating system's private app storage. App lock restricts entry through the interface; it is not independent PDF encryption. A user may deliberately share files through installed applications; those recipients then control their copies.

Users can export account metadata, share/export local documents, move documents into recoverable trash, and request account deletion. Account deletion disables access and queues cloud object/database removal with retries. Local files remain on the device. Uninstalling removes app-local files; export important data before uninstalling. Trash is retained until an explicit permanent-deletion feature/retention policy is implemented.

Purchase verification contacts Google Play or Apple using purchase identifiers/tokens, without sending document contents. Google and phone authentication contact their configured providers. Store purchases are bound to the signed-in Folio account. Provider privacy disclosures and platform store privacy labels must be completed by the operator.
