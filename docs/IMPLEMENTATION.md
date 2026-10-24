# Implementation and verification ledger

Implementation session: **2026-10-24**. Repository started with a README only—no application, dependencies, CI or external configuration. Work remains on `arena/059cdeab-him-and-i`. No credentials, production data, signing material or generated build outputs have been added. Changes are saved in the working tree; no commit, push, PR, deployment or remote CI execution is claimed.

## Delivered scope

1. **Foundation/design:** Next App Router, React, strict TypeScript, Tailwind/CSS tokens, self-hosted licensed fonts, Motion/Lucide, reusable controls, Persian-first RTL and English LTR, responsive shell, reduced motion, focus/keyboard/contrast fixes and honest configuration/empty/error/offline states.
2. **Authentication/security:** Supabase cookie auth and verified server boundaries, signup/confirmation/recovery/PKCE and token-hash callbacks, transactional two-slot spaces and hashed expiring single-use invitations, eight SQL migrations, 30-table RLS, private Storage and executable authorization tests.
3. **Shared application:** actual-data home and relationship counter; paginated/searchable memories and chat; private image/video/voice handling; reactions/replies/read receipts/retries; server-released letters; timezone-aware calendar/RSVP/reminders.
4. **Individual boundaries:** expiring optional mood sharing with owner-only notes; owner-private cycle records, settings, approximate estimates, minimal opt-in sharing/revocation, discreet owner reminders, separate health export/deletion.
5. **Music/games/native:** external-link playlists/favorites, three persisted reveal-protected games with recent history, Android/iOS platform source and branded assets, trusted HTTPS/offline shell, invite deep links, lifecycle/permission configuration and native export/share boundary.
6. **Operations/verification:** in-app notifications/preferences/devices, optional Web Push worker, ordered/paginated export, password-confirmed account deletion and durable object cleanup, pinned/read-only CI definitions, deployment/security/mobile/test documentation.

There is no invented relationship date, user profile, conversation, memory, music playback, typing presence or delivered-notification claim. Missing providers block their operations. Native APNs/FCM **delivery** and native local-notification scheduling are explicitly not implemented; native registration is not delivery.

## Important final hardening

- Images are decoded/normalized with EXIF removal and pixel/byte bounds. Audio duration is parsed and compared with the declaration; WebM recordings receive duration repair. Container inspection is not a malware scan or full transcoder.
- Storage INSERT and SELECT are removed for ordinary clients. This closes both unchecked direct uploads and user-selected, arbitrarily long-lived Storage signing. The server rechecks caller RLS before signing the authorized path for exactly 60 seconds.
- Memory favorites filter at the database relation before pagination, not only the already-loaded page.
- Reactions and RSVPs use atomic RPCs rather than separate delete/insert requests.
- Exports advance through actual returned rows, even below a provider row cap; no silent 10,000/1,000-row truncation. They are streams, not a transaction snapshot or media archive.
- Auth/profile deletion occurs before physical media removal, with a durable cleanup queue; attachment-only message cascades are explicitly tested. The last account deletion also erases empty-space relationship metadata, including concurrent deletions.
- Period dates and all-day/relationship semantics are checked in SQL as well as the API. Recurring all-day events preserve local calendar-day boundaries through DST; monthly invalid days are skipped.
- Realtime subscribes only to RLS-checked INSERT/UPDATE events, never DELETE payloads. Chat read updates require a visible tab at the conversation bottom; playback uses a temporary memory blob rather than replacing signed URLs mid-clip.
- Build/start refuses private keys mistakenly placed in public configuration before emitting a browser bundle. Development request-URL and native bridge logging are disabled to avoid leaking tokens/export contents.
- Request bodies are bounded while streaming; push subscription endpoints are checked in API, SQL and worker. Process-local invalid-attempt defenses supplement, not replace, provider/distributed limits.
- Cycle notifications/data are excluded from the shared home/account export. A revoked sharing flag removes future projection access; previously viewed/downloaded content cannot be recalled.

## Executed checks and results

| Command/check                                                                  | Actual result                                                                                                                                                  | What it does **not** establish                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                         | Passed                                                                                                                                                         | Semantic correctness                                                                                    |
| `npm run lint`                                                                 | Passed, zero warnings allowed                                                                                                                                  | Independent security audit                                                                              |
| `npm run typecheck`                                                            | Passed (`next typegen` + `tsc --noEmit`)                                                                                                                       | Provider configuration correctness                                                                      |
| `npm test`                                                                     | **120 passed / 13 files**: 43 SQL/RLS tests + 77 unit/component/mocked-boundary tests                                                                          | Hosted Supabase/native/provider end-to-end operation                                                    |
| `npm run db:check`                                                             | All eight migrations and 15-question seed applied in isolated PGlite                                                                                           | A complete Supabase service stack                                                                       |
| `npm run db:types`                                                             | Generated table types from versioned migrations                                                                                                                | Full live-project schema drift verification                                                             |
| Genuine PostgreSQL via temporary local launcher + `scripts/postgres-tests.mjs` | Migrations/seed passed on PostgreSQL 18.4; **all 6 multi-connection race scenarios passed**, including cleanup/exit after fixing the test-runner teardown race | Hosted Auth/Storage/Realtime service behavior                                                           |
| `NEXT_TELEMETRY_DISABLED=1 npm run build`                                      | Production build passed; Next completed its **29/29** page-generation preparation steps and emitted the full route table                                       | A deployed application or configured private-data flows                                                 |
| `npm run test:e2e:sandbox` against the running **production build**            | **80/80 passed** in ~2 minutes: 46 interaction/responsiveness checks + 34 axe checks (17 routes × desktop/mobile)                                              | Populated authenticated screens, Safari, native OS/device behavior, or manual screen-reader conformance |
| `npm audit --omit=dev`                                                         | **0 reported production dependency vulnerabilities** at verification time                                                                                      | Absence of future vulnerabilities or application bugs                                                   |
| `npm run native:sync`                                                          | Both platform projects synced with **9 plugins**, in explicit unconfigured/setup mode                                                                          | Android/iOS compilation, signing, installation or delivery                                              |
| Native/config source parsing                                                   | Xcode project parses and includes the privacy manifest resource; iOS plist, Android XML/security/permission declarations and Supabase TOML parse               | Xcode/Gradle builds or full Supabase CLI configuration execution                                        |

The full browser run initially exposed a missing chat attachment-input label; that was fixed and the **entire** 80-test suite reran successfully. Earlier contrast/accessibility failures were fixed in the actual UI rather than excluded from axe. The production preview is running on port 3000, bound to `0.0.0.0`, with no host/framing warnings and no external credentials.

Diagnostics/screenshots, temporary PostgreSQL/Chromium tooling, caches and reports remain ignored; they are not shipped personal sample data. See [TESTING.md](TESTING.md) for reproducible commands, each layer's limitations and the hosted acceptance checklist.

## Important files

- `src/app/`, `src/components/features/`, `src/components/ui/`, `src/app/globals.css`: routes, feature screens, accessible primitives and design system.
- `src/schemas/actions.ts`, `src/lib/server/`, `src/lib/supabase/`, `src/proxy.ts`: validated/authenticated boundaries and cookie sessions.
- `src/app/api/{actions,data,media,auth,export,account,jobs}/`: actual provider integrations and trusted operations.
- `src/lib/{dates,cycle,media,push,data-export,notification-client}.ts`: recurrence, owner wellbeing, media and device behavior.
- `supabase/migrations/202610240001_core.sql` through `202610240008_empty_space_erasure.sql`, `seed.sql`, `config.toml`: database security and jobs.
- `tests/integration/authorization.test.ts`, `tests/unit/`, `tests/e2e/setup.spec.ts`, `scripts/postgres-tests.mjs`: executed test coverage and real concurrency runner.
- `capacitor.config.ts`, `android/`, `ios/`, `native-web/`, `scripts/native-sync.mjs`: native source and build/configuration boundaries.
- `.github/workflows/{ci,native-checks}.yml`: defined checks with pinned action SHAs; neither has run on GitHub in this session.
- `README.md`, `docs/{DEPLOYMENT,SECURITY,MOBILE,ARCHITECTURE,TESTING}.md`: operator handoff and honest remaining work.

## Required external work before real users

1. Provision a dedicated staging/production Supabase project, apply migrations/seed, set public configuration and the server-only secret, configure real SMTP/Auth redirects and test provider-side grants and Storage ownership/signing denial.
2. Deploy to a trusted HTTPS origin and schedule the protected POST worker. Configure VAPID only if Web Push is wanted. Verify actual permission/delivery/revocation and monitor outbox/cleanup failures; no job or notification has run against a real provider here.
3. Run the two-person/third-account hosted acceptance checklist with synthetic data, including active-session Realtime, real media and scheduled release. Current browser tests deliberately use the credential-free setup mode; provider tests are SQL-level or mocked where identified.
4. Choose real app IDs/domain associations/signing identities. Build Android with JDK 21/SDK 36; build iOS on macOS/Xcode. Perform the device/privacy/permission/export/audio tests, including native cookies/email handoff and OS share timing. There are no signed binaries or successful native compilation claims.
5. Implement and verify native APNs/FCM server adapters if native push is required. Add consent-aware native local scheduling only if wanted; the installed plugin alone is not a feature. These remain actual code work, not merely missing credentials.
6. Add production distributed/ingress abuse controls, review CSP/logging/backup operations, publish controller/contact/region/retention and store health-data disclosures, and commission appropriate security/privacy review.

## Deliberate product/runtime limits

4 MiB per file, 8 files per memory, 120-second voice limit; no full audio/video transcoding/malware service. Memory/message history is paginated; secondary screens use bounded recent lists as documented in `ARCHITECTURE.md`. Exports omit media bytes/secrets and are not immutable snapshots. No private offline datastore, typing protocol, full arbitrary recurrence engine, native push adapter or native local schedule is represented as finished. Service administrators and previously authorized recipients remain in the privacy threat model; this is **not E2EE**.
