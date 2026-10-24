# Web and Supabase deployment

No deployment has been made by this implementation. Use a separate staging project with synthetic accounts before production. This application needs a Node server/serverless Next runtime; static export alone cannot enforce its API boundaries.

## 1. Configuration

Copy `.env.example` to ignored `.env.local` for local work, or set these in your deployment's secret/environment manager. Never paste provider/signing credentials into source, chat, issues, build output or a native config file.

| Variable                               | Visibility                  | Required for                                                                                                                    |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public                      | Supabase HTTPS API origin; local HTTP allowed only for local development                                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public                      | Browser/SSR client; preferred public key                                                                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Public legacy alternative   | Fallback legacy `anon` JWT, never `service_role`                                                                                |
| `NEXT_PUBLIC_APP_URL`                  | Public                      | Canonical HTTPS app origin; use `http://localhost:3000` in local development                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`            | **Server secret**           | Supabase `sb_secret_...` or legacy service-role key; inspected uploads, fixed-lifetime media signing, account deletion and jobs |
| `CRON_SECRET`                          | **Server secret**           | Random 32+ character bearer secret for the reminder/cleanup job                                                                 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | Public, optional            | Standards-based Web Push device registration and signing                                                                        |
| `VAPID_PRIVATE_KEY`                    | **Server secret**, optional | Web Push delivery worker                                                                                                        |
| `VAPID_SUBJECT`                        | Operator contact, optional  | Valid `mailto:`/HTTPS contact for VAPID                                                                                         |
| `CAPACITOR_SERVER_URL`                 | Native build configuration  | Trusted HTTPS web origin, not an API credential                                                                                 |
| `CAPACITOR_APP_ID`                     | Native build configuration  | Must match both committed platform IDs; initial placeholder `io.github.mgnoies12.himandi`                                       |

Generate a cron secret locally with `openssl rand -hex 32` and store the result directly in the host's secret manager. Generate VAPID keys with the installed tool (`npx web-push generate-vapid-keys`) in a private local terminal; never commit/log the private key.

`NEXT_PUBLIC_*` values are compiled into browser JavaScript. Rebuild after changing them. Missing/incomplete Supabase configuration yields explicit setup UI and API 503s. Private keys mistakenly placed in either public key variable, or credentials embedded in public URLs, instead fail the build/start before any browser bundle can expose them. Missing service configuration disables the affected operation rather than pretending to upload, sign or delete.

## 2. Database and Auth

Use a **dedicated new Supabase project**, not a shared `public` schema containing another application. Initial grants/revocations intentionally replace broad default public-schema access.

Apply these files in order with the Supabase SQL editor, or the operator-installed Supabase CLI:

1. `202610240001_core.sql`: 30-table schema, identity guards, membership/invite transactions, RLS, letter/game/cycle boundaries and cleanup triggers.
2. `202610240002_delivery_storage.sql`: notifications, worker leasing, private bucket and Realtime publication.
3. `202610240003_hardening.sql`: subscription/JSON bounds, game answers, immutable scheduled cancellation rules, DST/month-day recurrence and worker update.
4. `202610240004_trusted_uploads.sql`: removes direct client Storage writes.
5. `202610240005_account_cleanup.sql`: safely tombstones attachment-only messages during file/account FK cascades.
6. `202610240006_atomic_mutations.sql`: atomic reaction/RSVP RPCs, direct-write date/link validation and batch cleanup acknowledgement.
7. `202610240007_trusted_signing.sql`: removes direct client Storage reads/signing; fixes the bucket cap at 4 MiB.
8. `202610240008_empty_space_erasure.sql`: removes the relationship date and empty conversation/space after the last account is deleted, with a serialized concurrent-deletion check.
9. `supabase/seed.sql`: 15 public bilingual game questions; no personal example rows.

CLI alternative, from this checkout, after installing the current compatible Supabase CLI and authenticating **outside chat**:

```sh
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase db push
# Run seed.sql explicitly in the SQL editor, or use the CLI's supported include-seed option.
```

For a local full Supabase stack, install Docker and Supabase CLI, then `supabase start` and `supabase db reset`. The committed `config.toml` selects PostgreSQL 17, short auth JWT lifetime, confirmations, 12-character passwords and no local analytics. **A full Docker/Supabase stack has not been started in this environment.** The separate SQL scaffolds are not substitutes for hosted service verification.

In the hosted Auth settings:

- Set Site URL to the exact HTTPS app origin. Allow `/auth/callback` and `/auth/confirm` URLs on that origin, plus explicit staging/local equivalents as needed. Never allow an arbitrary wildcard production redirect domain.
- Enable email/password, confirmation and an operator-owned SMTP provider. Use at least 12-character passwords and a short access-token lifetime (the local config uses 15 minutes).
- Keep provider Auth abuse limits enabled. Add ingress/distributed limits and CAPTCHA before public registration if the risk warrants them; the process-local application limiter is not fleet-wide protection.
- Verify that `on_auth_user_created` creates the profile/private defaults and that the requested tables are in the Realtime publication. Do not put cycle/mood-note tables into that publication.

### Email confirmation and recovery templates

The normal PKCE callback is `/auth/callback`. Its verifier is in the originating browser's cookies; opening the email in a different browser/native shell may lack that verifier.

For cross-browser email completion, use Supabase's one-time token-hash template links instead:

```text
Confirmation:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/home

Recovery:
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
```

The handler calls `verifyOtp`, accepts only explicit supported types, rejects reused/expired tokens through the provider, and restricts redirects to local paths. Confirmation in an external browser does not silently transfer that browser's cookies to a native WebView; after confirming, return to the app and sign in. A user who was following an invitation can reopen that invitation after confirmation. Test real SMTP, replay/expiry and the native email handoff before release.

## 3. Private Storage and media

Migrations create `couple-media` as private. **Do not add a public or authenticated bucket read/write policy.** Upload and signing requests go through Next:

- `/api/media`: verifies the user/origin, bounds the request, validates/normalizes bytes, reserves metadata using that user's RLS, then uses the server secret to write the object.
- `/api/media/[id]`: selects authorized metadata with the user's RLS before the trusted signer issues a 60-second URL. Client-provided expiry/path values are not accepted.

A user's direct Storage upload, download/list and long-expiry signing request must fail even when they can read the asset metadata. This is deliberate, not a reason to weaken the policy. New file access must fail after metadata deletion, and scheduled letter assets must fail before release. Check these with separate authenticated staging accounts.

The 4 MiB file + bounded multipart overhead fits common 4.5 MB serverless request limits. Do not raise the cap without reviewing host limits, inspection resources, Storage limits and native/browser memory. The Node runtime needs Sharp's supported native binary; `npm ci` installs the platform optional package. For large uploads/transcoding, build a separate trusted, asynchronous inspection pipeline rather than allowing unchecked direct uploads.

## 4. Reminder, delivery and deletion worker

Schedule one authenticated **POST** every minute (or document your chosen delay) to:

```text
https://YOUR_APP_DOMAIN/api/jobs/reminders
Authorization: Bearer <CRON_SECRET from the scheduler's secret store>
```

Use a hosting scheduler that can make POST requests with a secret header, a server cron, or Supabase `pg_cron` + `pg_net` with a Vault secret. Do not put the secret into a URL or a committed cron command. Configure this explicitly: there is no pretend default schedule or unprotected public job endpoint. Vercel's built-in GET cron cannot call this POST-only handler without an appropriate trusted adapter; use a POST-capable scheduler instead.

Example shell invocation with preexisting environment secrets, for a private operator terminal (disable shell tracing):

```sh
curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${NEXT_PUBLIC_APP_URL}/api/jobs/reminders"
```

The worker transitions due letters, queues due event/owner-only private reminders, clears stale metadata/retention rows, drains physical deletion batches and optionally delivers generic Web Push. It verifies bearer length and uses a timing-safe comparison. Database leases prevent simultaneous workers claiming the same push item; failed/delayed delivery is bounded/retried, not guaranteed. If a push hits its retry limit it must be investigated, not relabelled delivered.

Configure VAPID only if Web Push is wanted. The service worker has **no fetch/private-data cache**. Browser permission is requested only after explanation and a click. Test permission denial, unavailable browsers/iOS installation requirements, stale endpoint removal, preference changes and device revocation. Payloads always point to `/notifications` and contain no message, letter, mood or cycle details.

APNs/FCM tokens can be registered by the native shell, but native server delivery adapters are **not implemented**. Do not report native push as operational after merely saving a token. See `MOBILE.md` for the explicit remaining integration work.

Monitor cron health, oldest cleanup item, failed attempts and outbox states with privileged operator tooling. Never put content, tokens or paths into application telemetry. If jobs stop, release-time authorization still works, but reminders, physical erasure and retention sweeps stop. Backups and failure-response retention must be documented independently.

## 5. Deploy Next.js

A Node 22-compatible Next host (including a properly configured serverless host) can run:

```sh
npm ci
npm run check
npm run start
```

For serverless deployment, select Next.js, use `npm run build`, set public variables at build time and server secrets only in the runtime/host secret manager. On a server, proxy HTTPS to the bound port and **preserve the actual Host**, overwrite forwarding headers, enforce request limits and disable caching for API/private responses. Never let client JavaScript call a backend at localhost; all application API URLs are relative.

- Separate production and preview Supabase projects. No production data/secrets on untrusted PR builds.
- Keep private routes/API responses uncached at a CDN. Do not enable an offline cache for their contents.
- Verify CSP connects only to the intended Supabase origin. Production sets HSTS; install HTTPS before enabling it. Tighten the Arena-only framing exceptions on a standalone deployment if the app need not be embedded.
- Redact invitations/auth token hashes/codes/signed media URLs from access logs and error/analytics products.
- Run a two-person staging smoke test and a third unrelated account isolation test; use the checklist in `TESTING.md`.
- Set a backup lifecycle, test restore/migration recovery and establish an incident-response contact before live use.

## 6. Release gates

Supply operator-selected app IDs/domains, controller/contact/hosting-region details and backup retention. Verify hosted Auth, Storage (including direct-signing denial), Realtime isolation/cleanup, the scheduler and optional provider delivery. Compile/test native devices and review store health-data/required-API disclosures. Review dependent library advisories at release. These are external operational steps, not already completed work.
