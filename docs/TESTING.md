# Testing and acceptance

All repository tests use isolated synthetic data. Never point test tooling at production or put real invitations, messages, recordings, health records or provider credentials into traces.

## Layers and what each establishes

### Unit/component and mocked boundaries

```sh
npm run typecheck
npm run lint
npm test
```

Vitest/RTL cover public-key/redirect/push-SSRF configuration, input/media validation, actual Sharp decoding/metadata stripping and WAV inspection, timezone/Persian-calendar/DST/all-day recurrence, cycle estimation, accessible primitives, server auth/origin/size checks, auth handlers with an isolated provider mock, authorized fixed-lifetime signing with a mocked service client, complete export pagination/stream failure, and native filesystem/share boundaries with mocked plugins.

Mocks verify our control flow and parameters; they do **not** verify SMTP, a deployed Supabase REST/Storage service, a native OS permission/share implementation, or provider delivery.

### SQL/RLS integration

```sh
npm run test:db
npm run db:check
npm run db:types
```

PGlite executes the actual versioned SQL/seed in a fresh PostgreSQL-compatible engine. A minimal `auth`/`storage` scaffold supplies synthetic users, roles, `auth.uid()` and bucket/object tables. Tests change database roles and JWT subject context; they do not rely on a mocked authorization function. Each test rolls back its fixture changes.

Coverage includes anonymous/cross-couple access, immutable ownership, valid/invalid/expired/revoked/reused invitations, maximum two slots, memory/media linkage and cleanup, denied direct Storage I/O, persisted chat/replies/tombstones/rates/receipts/reactions, pre-release letter body/media denial and post-release access, private mood notes/expiry, owner-only cycle tables/minimal sharing/revocation/deletion, direct-write date constraints, all-day validation, calendar/DST recurrence, notification privacy/preferences/subscription SSRF, game reveal/duplicates/consent, and account deletion with attachment-only messages.

This is genuine SQL-policy execution but **not a running Supabase stack**. Auth JWT signature validation, PostgREST schema exposure, Storage HTTP signing and Realtime transport still need hosted tests.

### Genuine concurrent PostgreSQL

```sh
DATABASE_TEST_URL='postgres://postgres:YOUR_LOCAL_TEST_PASSWORD@127.0.0.1:5432/postgres' \
  npm run test:postgres
```

The runner accepts only localhost/loopback URLs, creates a randomly named disposable database, applies all migrations/seed and uses separate connections. It then closes connections before dropping only that database. A database-creating test role is required. Database roles may remain in that disposable local cluster, so do not use an instance containing personal databases.

Six concurrency scenarios:

1. Two people race the same token: exactly one winner.
2. One person races invitations to two spaces: at most one membership.
3. Two tokens race one remaining slot: no overcapacity and no consumed losing token.
4. 41 concurrent message inserts: exactly 40 accepted, one rate-limited.
5. Simultaneous push workers: no duplicate outbox claim.
6. Simultaneous partner account deletion: no leftover empty couple/relationship metadata.

The local implementation was exercised with a temporary PostgreSQL 18.4 binary installed under ignored `.arena/`; that disposable launcher/database is not a project dependency or portable artifact. The committed runner is `scripts/postgres-tests.mjs`; CI defines a PostgreSQL 17 service. A standalone local PostgreSQL or Docker test instance can reproduce the committed runner without the ephemeral sandbox files.

### Real browser checks

```sh
npx playwright install --with-deps chromium
npm run test:e2e
# Restricted Linux sandbox alternative:
npm run test:e2e:sandbox
```

Playwright starts/reuses the app with **no Supabase credentials**, in desktop Chromium and a mobile Chromium viewport. It checks real rendering/interactions: default Persian/RTL, English/LTR persistence, explicit configuration boundaries, missing-config API responses, CSRF rejection, 13 route layouts/navigation/runtime errors, memory filters/form, letter modal focus/Escape, Persian month navigation, cycle consent defaults, no fake music/game success, invitation entry/invalid route, offline feedback, localStorage token absence in setup mode, security headers and reduced motion. Axe runs WCAG A/AA checks on 17 public/setup routes, without excluding contrast rules.

The sandbox wrapper uses npm-packaged Chromium and its bundled Linux library pack because the environment cannot download browser binaries from arbitrary hosts. It uses only the rendering flags explicitly listed in the script, not a blanket disable-web-security configuration. `--no-sandbox` is only for this isolated test runner; it is not a user browser setting.

**These browser checks do not sign into real accounts or exercise populated/private-data states.** An iPhone viewport in Chromium is not Safari/iOS. Automated accessibility checks do not prove full accessibility or replace screen-reader/manual review.

## Hosted staging acceptance (requires external configuration)

Use newly created synthetic accounts A and B in space One, C and D in space Two, and E without membership. Keep actual secrets outside traces and logs.

### Auth and membership

- Exercise real signup, SMTP confirmation, expired/replayed email links, invalid credentials, password reset/update and short JWT refresh/expiry. Verify CSRF failures and cookie settings.
- Confirm protected pages redirect anonymous users and every data/mutation/media/export API rejects them.
- Invite E without revealing any personal data; accept only after sign-in. Replay/expire/revoke and race tokens from independent clients. Verify the losing request cannot consume a usable remaining invitation or create a second membership.
- Query PostgREST directly as A and C, not just through the UI. Ensure profiles, memberships and all couple data stay separated.

### Memories, media, chat, letters

- Create/edit/delete/favorite/tag/search a memory; paginate beyond 24 rows and check no duplicates/lost rows with equal timestamps.
- Upload valid images/video/recorded voice; reject size, MIME/extension/signature mismatch, malformed images and spoofed/over-limit voice duration. Verify image metadata is stripped.
- A can access authorized linked media through the Next endpoint; C cannot. Unattached media and letter drafts stay owner-only. Direct client Storage upload/read/list/signing—including a one-year expiry—must fail. API-signed URLs last 60 seconds. Never "fix" this by adding an authenticated Storage SELECT policy.
- In two authenticated browsers, verify Realtime token authentication, cross-space isolation, reconnection/unsubscription, UUID retry reconciliation, paging/search/replies/reactions and actual visible-bottom read receipts. Check author deletion and removed account/file cascades. Verify no DELETE subscription leaks cross-space metadata.
- Verify voice permission denial, stop/unmount track cleanup and playback/seeking through the entire 120-second limit on target devices.
- A schedules a letter; B and C query the table, nested assets and `/api/media/[id]` before/after release. B must not retrieve body/media before release. Check cancellation, immutable sent fields, opened state and delayed scheduler behavior.

### Dates, moods, cycle, games

- Create all-day/timed events in at least UTC, Europe/London, Asia/Tehran and America/New_York; check both DST transitions, ambiguous/nonexistent local input, monthly day 31 and RSVP updates. Advance the displayed calendar several months and verify recurring markers.
- Share/unshare/expire a mood, inspecting direct queries for private-note/history leakage.
- Query all cycle tables/API/export as B and C: only their own data is visible. Toggle status/date independently, revoke each, then requery immediately. Check owner deletion/export and disabled reminders/predictions. No cycle content should enter shared home or account export.
- Verify two-answer reveal, no partial answer leaks, independent daily consent, duplicate/invalid answer protection, historical rounds and idempotent daily-to-memory saving.

### Delivery, deletion and operations

- Run the actual scheduler with and without authorization. Confirm due reminders, generic notification payloads, disabled categories, owner-only cycle recipient and processed one-time reminders. Run two workers concurrently.
- With VAPID configured, test real delivery, permission refusal, stale endpoints, revoked devices, disabled push and logout. Inspect payloads without logging endpoint keys. Native tokens alone must not be reported as delivered; adapters/device tests remain required.
- Export more than the provider row cap; verify the separate health scope and no tokens/media bytes. Test export cancellation/failure. Do not call a concurrently modified export an immutable snapshot.
- Delete an account containing text/image/voice messages, memories, incoming/outgoing letters and cycle data. Verify Auth/profile/owned rows and incoming letters are gone, the partner's unrelated rows survive, new signing is denied and queued objects are physically erased. Simulate Storage failure and rerun cleanup.
- Audit deployed grants, bucket policy, Realtime publication, host caching/CSP/HTTPS/log redaction, backup retention/restoration and security advisories. Complete `MOBILE.md` device checks and `IMPLEMENTATION.md` remaining work before release.

## CI

`ci.yml` defines format/lint/types/unit-SQL/migration/race/build/audit/browser checks with pinned action SHAs and read-only repository permission. It does not inject real credentials or deploy. `native-checks.yml` is manually triggered and compiles a setup-mode debug/simulator app without release signing. No privileged `pull_request_target`, automatic production merge/commit, or signing secret is used. Workflows still need an actual GitHub run after the code is published.
