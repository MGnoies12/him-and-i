# HIM & I

**یک دنیای کوچک، فقط برای ما.** A private little world for two.

A Persian-first, RTL/LTR couples application: warm scrapbook design, real Supabase persistence and authorization, and Android/iOS Capacitor projects. This is an application, not a seeded personal dashboard. Without configuration it shows explicit, data-free setup states and refuses writes.

> **Release status:** local implementation and verification, not a deployed or independently security-audited release. Hosted Auth/Storage/Realtime, production scheduling/push, and native device behavior require the checks in [the verification ledger](docs/IMPLEMENTATION.md). No signed Android/iOS release or deployment has been produced.

## Run the web application

Use Node **22.22.3** (`.nvmrc`) and npm. Compatible runtime range is recorded in `package.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev
# http://localhost:3000 — also binds 0.0.0.0 for a hosted preview
```

You can inspect all setup screens without credentials. To use real accounts and data:

1. Create a **dedicated Supabase project**. Apply migrations `001` through `008` in filename order, then `supabase/seed.sql`. The seed contains only 15 bilingual game questions, never personal content.
2. Set the public Supabase URL/publishable key and your canonical app URL in `.env.local`.
3. Configure Supabase Auth email confirmation, SMTP, and redirect URLs.
4. Set the **server-only** Supabase secret/service-role key for inspected uploads, authorized media signing, cleanup/jobs, and account deletion.
5. Schedule the protected reminder/cleanup endpoint. Optional Web Push additionally needs VAPID keys.
6. Restart the dev server after changing environment variables. Public variables are baked into production builds.

See [deployment and Supabase setup](docs/DEPLOYMENT.md) for exact steps, email templates, cron configuration and release gates. Never put a secret/service-role key in a `NEXT_PUBLIC_*` variable.

## Implemented application

| Area                     | Behavior in source                                                                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and invitations | Email/password signup, confirmation/PKCE callback, cross-browser token-hash confirmation, recovery, sign-out, profile/timezone settings; two transactional membership slots; random hashed, expiring, revocable, single-use invitations                                     |
| Home and memories        | Actual-data home; optional relationship counter; memory CRUD, title search, category/favorite filters, tags, grid/timeline views, pagination, private photo/video gallery, upload progress and errors                                                                       |
| Conversation             | Persisted, paginated/searchable chat; authorized Realtime insert/update subscriptions; UUID-based optimistic retries/deduplication; replies, atomic reactions, image/voice attachments, visible-bottom read receipts, unreads, author deletion; no pretend typing indicator |
| Letters and calendar     | Private drafts; immediate/scheduled letters with server/RLS release checks, open/cancel states and optional image/gift note; event CRUD, RSVP, all-day/exclusive-end semantics, IANA zones, weekly/monthly recurrence and reminder jobs                                     |
| Moods and wellbeing      | Optional expiring mood sharing with separate owner-only notes; owner-private cycle history, symptoms, settings, estimates and reminders; two independent minimal-sharing opt-ins, revocation, separate export and permanent record deletion                                 |
| Music and games          | Shared playlists/favorites of legitimate external music links, no unlicensed streaming; three persistent games with backend reveal rules, duplicate prevention, recent round history and daily-answer-to-memory saving                                                      |
| Notifications and data   | In-app center, category preferences, per-device registration/revocation; optional Web Push worker; paginated streaming JSON export, password-confirmed account deletion, durable media-erasure queue                                                                        |
| Native and accessibility | Included Android/iOS projects, branded assets, HTTPS shell/offline fallback, invite deep links, microphone/notification declarations, lifecycle/network handling and native export/share boundary; RTL/LTR, local fonts, focus/keyboard controls, reduced motion            |

**Important boundaries:** not end-to-end encrypted. Cycle records never inherit a couple-sharing policy and are excluded from the shared home/account export. Recipients cannot retrieve a scheduled letter or its attachment before release. Storage is private with **server-only uploads and signing**; public clients cannot mint arbitrarily long-lived media links. See [security and privacy](docs/SECURITY.md).

### Routes

Public: `/`, `/login`, `/signup`, `/reset-password`, `/update-password`, `/invite/[token]`, `/privacy`.

Authenticated when configured: `/home`, `/chat`, `/memories`, `/memories/new`, `/memories/[id]`, `/letters`, `/calendar`, `/mood`, `/music`, `/games`, `/cycle`, `/notifications`, `/settings`.

The unconfigured preview intentionally exposes only data-free setup views, not an authentication bypass. Password changes still require a verified server session.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test                    # unit/component, mocked boundaries, SQL/RLS tests
npm run db:check             # all migrations + seed in isolated PGlite
npm run db:types             # regenerate strict table types from migrations
npm run build
npm audit --omit=dev

npx playwright install --with-deps chromium
npm run test:e2e             # desktop + mobile viewport, no real credentials
# Restricted Linux sandbox alternative:
npm run test:e2e:sandbox
```

Real multi-connection PostgreSQL tests are separate from PGlite:

```sh
# Use ONLY a disposable local PostgreSQL instance and a database-creating test role.
DATABASE_TEST_URL='postgres://postgres:YOUR_LOCAL_TEST_PASSWORD@127.0.0.1:5432/postgres' \
  npm run test:postgres
```

The runner refuses remote hosts and creates/drops its own random database. Do not use personal or production data. [Testing details and hosted acceptance checklist](docs/TESTING.md) distinguish SQL execution, mocked provider tests and genuine hosted integration.

GitHub Actions includes read-only-permission web/database/browser checks and a **manual**, unsigned native compilation workflow. They do not deploy, merge, sign, or use production credentials. Workflow files have been added; remote CI results are not claimed.

## Android and iOS

The full Next.js backend cannot be statically exported. Capacitor loads an explicitly configured, trusted **HTTPS deployment**; without it the bundled screen clearly says setup is required.

```sh
# .env.local: CAPACITOR_SERVER_URL=https://YOUR_TRUSTED_DEPLOYMENT
npm run native:sync
npm run native:android      # Android Studio: JDK 21, SDK 36, min SDK 24
# Or: cd android && ./gradlew :app:assembleDebug

npm run native:ios          # macOS + Xcode required; iOS deployment target 15
```

Identifiers/domains are clearly marked owner placeholders. Change the committed native identifiers before changing `CAPACITOR_APP_ID`. See [mobile build, signing, domain association and device testing](docs/MOBILE.md). Native APNs/FCM **registration** exists; server delivery adapters are not implemented, and no native push delivery is claimed. The local-notification plugin is configured but not scheduled by the application.

## Code map

- `src/app/`: App Router pages, trusted auth/data/action/media/export/account/job handlers.
- `src/components/features/`: feature screens; `ui/` and `layout/`: shared controls and responsive shell.
- `src/lib/server/`, `src/schemas/actions.ts`: validated boundaries, session checks, rate limits, upload inspection and exports.
- `src/lib/dates.ts`, `cycle.ts`, `media.ts`, `notification-client.ts`: date/privacy/media/device behavior.
- `supabase/migrations/`, `seed.sql`, `config.toml`: schema, RLS, transactional RPCs and local configuration.
- `tests/`, `scripts/`: executable checks and type/native tooling.
- `android/`, `ios/`, `native-web/`, `capacitor.config.ts`: platform source and fail-closed shell.
- [Implementation and verification](docs/IMPLEMENTATION.md) · [Architecture/design](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Security](docs/SECURITY.md) · [Mobile](docs/MOBILE.md) · [Tests](docs/TESTING.md).

### Current limits worth knowing

Uploads are capped at 4 MiB/file (8 memory files); voice recordings at 120 seconds. Images are decoded/re-encoded with EXIF removed; audio/video container inspection is **not** a malware scanner or full transcoding pipeline. Exports contain authorized JSON/asset metadata, not media bytes, and are paginated reads rather than a transaction snapshot. Some secondary screens show bounded recent lists. Offline private-data storage, a typing-presence protocol, native push delivery adapters and native local-notification scheduling are deliberately not claimed. Before public use, complete hosted/device QA and publish the operator's controller/contact/region/backup-retention disclosures.
