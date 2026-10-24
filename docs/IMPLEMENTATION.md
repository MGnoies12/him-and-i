# Implementation and verification ledger

Updated **2026-10-24**. Source is on `arena/059cdeab-him-and-i`; `main` is not automatically changed. The repository began with a README only. No credentials, real personal data, keystores or generated binaries are committed.

**No persistent HTTPS/Supabase deployment has been supplied.** A `setup-debug` APK is deliberately a setup screen, not an offline imitation of working signup/chat. See the [Persian setup guide](SETUP.fa.md), [Actions](https://github.com/MGnoies12/him-and-i/actions) and [labelled preview releases](https://github.com/MGnoies12/him-and-i/releases). Each downloadable build records its exact source commit, mode, version and checksum.

## Implemented scope

- Persian-first RTL/English LTR, licensed local fonts, warm scrapbook design, responsive accessible controls, honest empty/error/offline/configuration states.
- Real Supabase cookie authentication, signup/confirmation/recovery, verified server boundaries, private Storage, transactional two-person membership and RLS on **31 application tables**.
- Name/optional gender, timezone and owner-private presentation preferences; automatic Rose/Dusk suggestions with manual override and different navigation order. Gender never changes authorization or shared-feature access.
- Authenticated `/onboarding` and `/pairing`; optional private period date and explicitly known cycle length. Unknown length can save a date without estimating. Explicitly irregular cycles do not produce a next-date estimate. No health history is stored in Auth metadata.
- **12-symbol / 60-bit** typing codes, domain-separated hashes, 15-minute expiry, authenticated single-use acceptance. Existing 256-bit, 48-hour invitation links remain available. Making either kind revokes earlier pending invitations.
- Actual-data home, memory CRUD/media/search/favorites, persisted chat/voice/replies/reactions/read receipts, backend-released letters, timezone-aware calendar/RSVP/reminders, mood privacy, owner-only cycle history and minimal opt-in sharing.
- Shared external-link playlists, three backend-reveal-protected games, notifications/preferences, separate account/health exports and account deletion with durable physical-media cleanup.
- Android/iOS source and nine plugins, trusted HTTPS/offline shell, deep links, lifecycle/permission handling and native export/share. An APK build is not native push delivery or a device test.

## Executed local verification

| Check                           | Recorded result                                                                                                                                  | Limitation                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Format, ESLint, TypeScript      | Passed; zero lint warnings; strict generated schema types                                                                                        | Not an independent audit                                        |
| `npm test`                      | **166 passed / 19 files**: 54 SQL/RLS + 112 unit/component/mocked-boundary tests                                                                 | Provider and plugin mocks are not live services                 |
| `npm run db:check` / `db:types` | All **10 migrations** and the 15-question non-personal seed apply; types regenerated                                                             | Not a complete Supabase stack                                   |
| Real PostgreSQL runner          | PostgreSQL **17.10**, all migrations/seed and **7 multi-connection races passed**, including repeated runs                                       | No hosted Auth/Storage/Realtime transport                       |
| `npm run build`                 | Production compilation and route generation passed                                                                                               | No deployment or online accounts                                |
| Production Chromium browsers    | **88/88** full-suite checks passed; then **4/4** added onboarding/pairing axe checks passed (92 checks now defined), on desktop/mobile viewports | No real sign-in, Safari, Android WebView or device installation |
| Accessibility                   | 19 route checks per viewport; an additional Dusk-theme axe assertion in the personalization interaction; no excluded contrast rules              | Not complete manual screen-reader conformance                   |
| Dependency audit                | **0 reported production vulnerabilities** at verification time                                                                                   | Not absence of application/future vulnerabilities               |
| Native sync                     | Android and iOS synced with **9 plugins** in setup mode                                                                                          | Sync is not native compilation                                  |
| Native source checks            | Xcode project/privacy resource, plists, Android XML and Supabase TOML previously parsed successfully                                             | iOS remains uncompiled/device-untested                          |

The data-free production preview binds to `0.0.0.0:3000`. Temporary browser/PostgreSQL tools, traces, screenshots and build output remain ignored; test fixtures never use personal accounts or records.

## GitHub evidence and publication policy

The first actual Android run, [40071251382](https://github.com/MGnoies12/him-and-i/actions/runs/40071251382), **succeeded** on source `5f60ba4`: dependency install, TypeScript/tests, native sync, SDK 36, Gradle `assembleDebug` + `lintDebug`, packaging and artifact upload. Its publication job was correctly skipped because publication had not been explicitly requested. This proves that baseline's Android build—not installation or a working online backend.

The first web run failed in real PostgreSQL tests. Local reproduction exposed a deletion/invitation lock-order deadlock; migration **010** now locks the couple before profile cascades and consistently before invitation locking. Both concurrent partner deletion and invitation acceptance racing inviter deletion are covered by the real PostgreSQL runner.

The current APK workflow:

1. Builds/tests with pinned Node-24-compatible actions and JDK 21/SDK 36.
2. Distinguishes `setup` from `configured`; the latter requires a trusted HTTPS origin and positive `/api/health` readiness. The readiness probe retrieves zero personal rows and is not an end-to-end service test.
3. Verifies the APK signature, package identity and minimum SDK, and produces SHA-256/checksum/build metadata.
4. Publishes a **prerelease only** from this exact repository/branch on explicit `publish` or `[apk-release]` intent, and only after the matching source commit's full web/PostgreSQL/browser workflow succeeds.
5. Never merges, deploys production or embeds production secrets. Only the publication job has repository-write permission.

Check the linked Actions/Release metadata for subsequent remote outcomes; a workflow definition or a queued run alone is not evidence of success. CI debug keys are temporary, not operator-managed release signing. No iOS compilation, store submission, device QA or native delivery is claimed.

## Important privacy/security details

- Presentation preferences are owner-only. Disabling cycle tracking revokes sharing, predictions, reminders and cycle notifications, but deliberately retains private history until explicit erasure.
- Health records **and tracking/reminder consent flags** stay out of account exports; they are included in the explicit owner-private health export. Neither export contains authentication/device/invitation secrets or media bytes.
- Images are decoded/normalized, bounded and stripped of EXIF; audio/container inspection is not a malware scanner or full transcoding service.
- Ordinary clients cannot upload directly to Storage or mint long-lived signed URLs. Caller RLS authorizes metadata before server-only signing for 60 seconds.
- Letter release and game reveal are database boundaries, not hidden components. Previously seen/downloaded content cannot be recalled.
- Exports paginate by actual returned rows but are not transaction snapshots. Account deletion revokes data access before queued physical erasure; scheduler/backup operations remain necessary.
- Realtime subscriptions use authenticated RLS-checked INSERT/UPDATE events and cleanup; reconciliation handles deletions. There is no typing-presence claim and **no E2EE**.
- Public-key/origin guards reject accidental secret publication. Request bodies are bounded; provider errors, invitation URLs and health data are not logged by the app.
- Invalid pairing attempts are limited before validation (10/minute per account per process). These and other process-local/transactional limits do not replace production ingress/distributed abuse controls.

## Required operator work before real users

1. Dedicated Supabase project, migrations **001–010** + seed, real SMTP/Auth redirects, public configuration and server-only secrets.
2. Persistent trusted Next.js HTTPS hosting and a protected **POST** reminder/cleanup scheduler. GitHub Actions is not the chat server. Rebuild a configured APK after setting `CAPACITOR_SERVER_URL`.
3. Hosted synthetic two-account/third-account QA for Auth, Realtime, files, timed release, privacy revocation, exports and erasure. Follow [TESTING.md](TESTING.md).
4. Operator-managed release signing and real Android installation/update/audio/permission/export tests; macOS/Xcode and separate iOS signing/testing. See [MOBILE.md](MOBILE.md).
5. Native APNs/FCM server delivery adapters and consent-aware local scheduling if those are wanted: these are still code work, not just missing credentials. Web Push has a separate optional VAPID worker.
6. Distributed abuse controls, operational logging/backup policies, controller/contact/region/retention disclosures and independent security/privacy review.

Runtime limits remain documented: 4 MiB/file, eight memory files, 120-second voice, bounded secondary lists, no private offline datastore, no arbitrary recurrence engine or full transcoding/malware service. Infrastructure administrators can access stored data; this is not end-to-end encrypted.
