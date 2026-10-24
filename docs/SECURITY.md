# Security and privacy model

This is an implemented, locally tested authorization design, **not** an independent penetration-test certificate or an end-to-end-encryption system. Infrastructure administrators/service-role credentials can access stored data. Operators must assess this model for the sensitivity of couples' conversations and reproductive-health records before inviting real users.

## Trust boundaries

1. **Browser/native UI:** untrusted. Controls and hidden views are never the data boundary. Zod validates input again on the server. Origin checks reject missing/cross-origin state changes; JSON and multipart bodies are byte-bounded while being read.
2. **User server client:** verifies `auth.getUser()` and preserves that user's JWT for RLS. Build/start configuration rejects private/service-role keys in either public key variable and credentials embedded in public URLs before a client bundle is emitted; runtime public configuration also fails closed. Cookie sessions are SameSite=Lax and Secure on HTTPS/production; no authentication token is written to localStorage. Supabase SSR cookies are JavaScript-readable for the authorized Realtime client, so preventing XSS remains essential.
3. **Database:** every one of the 31 application tables has RLS. Grants and immutable-identity triggers restrict direct writes; SECURITY DEFINER functions use an empty search path, explicit identity/membership checks, and deliberately scoped EXECUTE grants. Internal helpers are not executable by public/anonymous/authenticated clients.
4. **Trusted service client:** server-only; needed for uploads/signing, deletion and worker duties. No service key is shipped in a bundle, native binary or `NEXT_PUBLIC_*` variable. Use a dedicated Supabase project: initial migrations deliberately revoke broad default grants in `public`, which is unsuitable for an unrelated existing application sharing that schema.
5. **Providers/operators:** SMTP, Supabase Auth/Storage/Realtime, web push providers, reverse proxies and backups are separate operational trust boundaries. Local SQL and mocked HTTP tests do not prove their hosted configuration.

## Invitations and membership

Random 32-byte URL-safe tokens; only SHA-256 hashes at rest; 48-hour expiry; revocable and single-use. Creating an invitation revokes older unconsumed invitations. Hashes cannot be selected by ordinary users. A token alone provides no read access. Authentication and transactional acceptance are mandatory. Constraints, row locks and a per-user advisory lock prevent reuse, overcapacity, or concurrent joins into two spaces. There is no public `couple_members` INSERT policy.

Invite paths, auth callback codes/token hashes and signed media URLs are secrets. The app uses `Referrer-Policy: no-referrer`, does not log request bodies/provider errors, and includes no analytics. **Configure your host/access logs to redact `/invite/*`, `/auth/*` query strings, Authorization/Cookie headers and signed Storage query strings.** Next development servers and third-party infrastructure may log URLs independently of application code; never use real invitations or health content in test traces.

Typing codes use 12 symbols from a 32-character alphabet (**60 random bits**), a domain-separated SHA-256 hash, and **15-minute** expiry. Codes and links share the same transactional acceptance/capacity rules; creating either revokes earlier pending invitations. The authenticated HTTP endpoint counts even malformed code attempts before validation (10/minute/account/process); apply distributed/provider protections before public use. Codes are not chat passwords and are unnecessary after successful membership.

Profile deletion locks the couple before any profile cascades, and invite acceptance locks couple before invitation. Migration 010 prevents cross-cascade deadlocks found during genuine PostgreSQL concurrency testing.

## Private personalization

`profile_preferences` is owner-only, not part of a shared profile or Realtime publication. Gender and Rose/Dusk suggestions affect presentation only; both accounts retain the same shared permissions, and anyone can override the suggestion. Optional health fields are collected only after authentication, never sent to signup/Auth metadata, URLs or analytics.

The private module is a separate opt-in regardless of gender. A single date produces an estimate only with an explicitly supplied usual length; an unknown length can save a date without predicting. Self-reported irregularity suppresses the date estimate. Disabling tracking immediately revokes minimal sharing, predictions and reminders but retains private history until explicit deletion. Account export excludes health records and tracking/reminder consent flags; the separate owner-private health export includes them.

## Letters and games

- Recipients cannot select the entire scheduled letter row, body, asset metadata or media before server time permits release. The API uses the same RLS check before signing an attachment. Authors can read their own drafts/scheduled letters.
- Sending locks body, recipient and release time. A delayed job affects notification timing, not the privacy boundary.
- A player can select their own answer. The partner's answer is inaccessible until both answers exist and the game's reveal requirements are met. The daily game additionally requires both independent consents. Duplicate answers and invalid choices are rejected in the database.
- These claims concern future access. They cannot erase content someone previously saw, downloaded or screenshotted.

## Cycle and mood privacy

`period_records`, `cycle_settings`, `cycle_reminders` and `cycle_sharing_preferences` are owner-only, even for the invited partner. They are not in the Realtime publication. No underlying health records, symptoms, notes or computed estimates appear in the shared home or account export. Health export is a separate authenticated owner-only request.

`get_partner_cycle_share()` returns only an opted-in short status and/or approximate date from a separate preference row. Each flag is independently off by default. Turning off a flag immediately removes it from subsequent queries and clears its stored shared field. Previously displayed data cannot be recalled. Only owners receive health reminders; preferences and each reminder both require explicit consent. All external pushes use the same generic title/body/link without health categories or content.

Cycle deletion removes owned records, symptoms/notes, reminders and cycle notifications and turns off sharing/predictions. Backups follow the operator's separately disclosed lifecycle. Estimates are labelled uncertain and handle insufficient/irregular history; there are no fertility/pregnancy/contraception claims.

Mood notes live in a separate owner-only table. Shared moods must be explicit and unexpired; sharing a mood never exposes the note or the owner's entire history.

## Media

- One private `couple-media` bucket, maximum 4 MiB per upload. Metadata associates owner, couple, purpose and opaque UUID path; callers cannot assign another person's file or forge storage paths.
- Extension/MIME/magic-byte allowlists, image decoding, a 16,777,216-pixel decode bound, resize to at most 2560 px and re-encoding without EXIF/GPS metadata. SVG/HTML and executable formats are rejected.
- Audio/video containers are parsed. Voice durations must be 1–120,000 ms and agree with parsed duration within 750 ms. Recorded WebM duration metadata is repaired before upload. This is **not** complete frame transcoding, malware scanning, or a proof that every device codec plays the file. Video/audio may retain their original embedded metadata; do not promise those are scrubbed.
- Final migrations remove authenticated Storage INSERT **and SELECT**. Allowing SELECT would let a user call Supabase's signing endpoint directly with a longer expiry. All uploads/signing instead pass the trusted handlers; signing rechecks caller RLS, then fixes the lifetime at 60 seconds.
- Do not re-add broad Storage policies to fix a configuration error. Storage-owner semantics and direct-signing denial must be checked on the real project before launch.
- Deleting metadata denies new access immediately and queues physical object removal. Previously issued signed URLs can remain valid for up to 60 seconds; loaded/downloaded copies cannot be recalled. Unattached reservations are eligible for cleanup after 24 hours.

## Deletion and retention

Account deletion reauthenticates the password. Auth/profile cascade deletion happens before physical file removal; it durably queues **all** asset paths, even beyond provider row limits. A bounded first batch is removed best effort immediately, with the rest/retries handled by the worker. This avoids erasing live-account files first and then failing to delete the account. Letters addressed to the deleted user are also deleted; the partner's other owned content remains. Once the last membership is deleted, the empty couple/conversation and relationship date are also erased, including concurrent partner deletions. Trusted service uploads do not assign end-user Storage ownership; an older deployment with user-owned Storage objects must migrate ownership before using this ordering.

The worker deletes detached assets after 24 hours, rate-window records after 2 days, notification rows after 90 days and invitations whose expiry is over 30 days old. Failed physical removals remain queued; least-attempted cleanup items are prioritized so persistent failures do not starve newer requests. Monitor and alert on the queue—retention jobs do nothing if not scheduled. Set and publish a backup-retention policy; this repository cannot remotely erase host backups or existing recipient copies.

Exports are RLS-scoped and exclude tokens/hashes. Do not send exports to support logs. Native exports are user-initiated and use a cache-only FileProvider path; third-party share destinations are outside the app's control once the user sends a file.

## Abuse protection and known operational limits

- Database counters limit successful transactional operations, including 40 messages/minute, 30 upload reservations/hour and invitation creation. Concurrency tests exercise the message limit.
- Process-local request limits additionally count invalid auth/mutation/upload attempts and bound expensive inspection. They are defense in depth, **not distributed rate limiting**. Failed SQL transactions roll their counters back.
- Keep Supabase Auth's provider limits on, configure SMTP/CAPTCHA as appropriate, and add trusted-ingress/WAF or shared-KV limits before a public launch. Ensure the reverse proxy overwrites forwarding headers; do not treat arbitrary `X-Forwarded-For` as trustworthy. The application accepts the request's real Host/canonical origin, never an arbitrary `X-Forwarded-Host` origin.
- The push worker rechecks both preferences and a small HTTPS provider allowlist. The database also validates subscription structure/endpoint hosts. It cannot become a general URL-fetching proxy. All revoked registrations are removed from future delivery lookups; a push already handed to a provider cannot be recalled.
- CSP blocks object embedding and unknown media/connect destinations; it retains Next-compatible inline script/style allowances. A strict nonce-based CSP is future hardening, not claimed here. Preview frame ancestors are allowed for Arena; tighten them for a standalone production deployment.
- No private offline cache, no service-worker fetch handler, no logging/analytics payloads containing health data. Normal browser/WebView memory and HTTP media caches, authenticated cookies, OS snapshots, downloaded exports and infrastructure logs/backups remain part of the threat model. Device-level storage/snapshot behavior still needs device testing.

Next development request-URL logging and Capacitor bridge logging are disabled to avoid exposing invite/email tokens, device identifiers or export contents. Hosting/CDN/provider logs still need independent redaction and retention controls.

For a vulnerability report, privately contact the repository operator using a channel they publish before launch. Do not attach real couples' data, raw invitations, tokens or health exports to public issues.
