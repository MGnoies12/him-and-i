# Architecture and design

## Runtime and data flow

- Next App Router + React + strict TypeScript; Tailwind and explicit CSS tokens; Motion respects the system's reduced-motion preference.
- React Hook Form/Zod forms and a shared discriminated action schema. Every privileged mutation is revalidated by the Next handler; most data writes use the authenticated user's Supabase client, never a service credential.
- Supabase SSR cookies, verified `auth.getUser()` boundaries and proxy refresh. Browser Supabase is for authorized Realtime and cookie refresh, not a localStorage session store.
- TanStack Query uses memory-only caches, loading/error/retry states and mutation invalidation. Memory/message lists use keyset pagination. Login/logout use a fresh navigation; a token-free BroadcastChannel clears/reloads sibling tabs when the session changes.
- RLS is the independent data boundary, including direct PostgREST requests. Identity columns are protected by grants/triggers. Multi-row or concurrency-sensitive operations live in transactional SQL functions.
- The service client is imported only from `server-only` modules, with persistence/automatic refresh disabled. Uses are limited to inspected Storage writes, fixed-lifetime signing after caller authorization, account deletion and trusted jobs.

No production feature switches to synthetic personal data when a request fails. The only product seed data is the public bilingual game-question catalog. Isolated test fixtures are synthetic and never shipped to a dashboard.

## Design system

| Token                    | Value     | Purpose                           |
| ------------------------ | --------- | --------------------------------- |
| Cream                    | `#FFF8F2` | Paper/background                  |
| Blush                    | `#F8DDE5` | Gentle surfaces                   |
| Rose                     | `#EBA9BC` | Decorative accents                |
| Dusty rose               | `#C9829A` | Borders/illustration accents      |
| Deep rose                | `#9E526E` | Actions and emphasis              |
| Plum                     | `#59404A` | Headings                          |
| Main text                | `#35252D` | Body text                         |
| Original muted           | `#8B7880` | Decorative brand palette          |
| White                    | `#FFFFFF` | Surfaces                          |
| Readable muted companion | `#75636B` | Small text with adequate contrast |
| Readable rose-on-blush   | `#91465F` | Accent text over blush            |

Vazirmatn supplies Persian, DM Sans supplies Latin UI text, and Cormorant Garamond supplies Latin serif/editorial accents. Fonts are self-hosted with Fontsource; SIL Open Font License copies are under `docs/licenses/`. No third-party font requests or analytics are installed. `public/images/together.jpg` is an AI-generated decorative illustration/photo asset, not a user's memory. Product icons are Lucide and custom vector hearts; essential actions do not depend on emoji glyphs.

Persian/RTL is the default. The language cookie persists explicit English/LTR selection; a profile stores locale and a user-chosen IANA timezone. UTC is the explicit initial timezone, not a guessed location. A button can copy the device timezone when the user chooses it. Native date inputs follow the device/browser; calendar grids and displayed dates use the chosen Persian/Gregorian calendar.

## Feature semantics

### Couple spaces

A space has at most two active rows, with slots constrained to 1 or 2 and one membership per user. A solo owner is the intentional onboarding state. There is no arbitrary public membership mutation. Creating a new invitation revokes prior unconsumed invitations for that space. Raw 256-bit tokens are shown only to their creator and transported in the private link; the database stores SHA-256 hashes. Acceptance locks both the joining user's identity and the relevant rows, verifies the inviter remains a member, consumes the token and adds the one remaining slot in one transaction.

### Shared and individual data

Memories/events/playlists belong to one couple; authors control their own changes/deletions. Mood notes are separate owner-only rows. Partner mood visibility is explicitly shared and expires, while owners retain their own history. Health rows never use `is_member()` as a read policy. Minimal health sharing is a distinct projection containing only an explicitly opted-in short status and/or a manually approved approximate date.

### Chat and media

Messages have a caller-generated UUID for idempotent retries. The database validates the conversation, sender, reply and attachment independently. Reactions and RSVPs use atomic RPC upserts. Message deletion is a tombstone that erases the body/reactions and detaches the media; account deletion removes authored rows.

Realtime uses authenticated Postgres INSERT/UPDATE events with RLS, optional narrowing filters and cleanup on unmount. It does **not** subscribe to DELETE: those events cannot be relied on for RLS-filtered payload isolation. Chat also refetches every 15 seconds for deletion/reaction reconciliation and reconnects; other views reconcile on mutation/focus or their documented interval. There is no typing/presence claim.

Media upload and signing are trusted-server operations. The server first reads/reserves metadata under the caller's RLS. Storage has no authenticated read/write policy, preventing users from bypassing inspection or requesting long-lived signed links. Audio/video is fetched into a temporary in-memory blob so a two-minute recording remains seekable after the 60-second URL expires. Blobs are revoked when the component unmounts. This is not an offline media cache.

### Letters, events and jobs

Letter visibility compares server time to `release_at`; a late scheduler cannot reveal early or prevent access after the release time. Sending freezes content and the release time. The sender can always read their own letter. Scheduled unreleased letters can be cancelled. The worker updates due state and creates generic notifications.

Event instants are stored in UTC with the event's IANA zone. Ambiguous/nonexistent initial local times are rejected rather than silently guessed. Weekly/monthly recurrences retain local start time, skip nonexistent DST hours and invalid month-days, and choose the later occurrence in a repeated DST hour. Timed-event durations preserve elapsed time; all-day durations preserve exclusive local calendar-day boundaries. Recurrence is deliberately a documented weekly/monthly subset, not arbitrary RRULE support. Reminder jobs send one generic update for a due occurrence, then advance to a future occurrence; they do not replay every missed occurrence after downtime.

Jobs are `POST /api/jobs/reminders` with a 32+ character bearer secret. The database owns deduplication and push leasing. Delivery is best effort; retries may repeat a generic push to a device if another device failed. Native provider adapters are not supplied. Cycle reminders are owner-only, explicitly enabled, one-time and discreet; the app does not infer fertility, pregnancy, sexual activity or relationship outcomes.

### Exports, limits and retention

Account and cycle exports are separate, ordered, paginated JSON streams. Page offsets advance by the rows actually returned, so a provider's smaller row cap does not silently truncate the export. This is not a consistent multi-table snapshot during concurrent edits. Media bytes and invitation/device/authentication secrets are excluded. The native export adapter writes only an app-cache file for user-initiated sharing, deletes it afterward, and clears interrupted-share leftovers at startup.

The UI currently bounds letters at 100, events at 500, mood history at 60, recent game sessions at 30 and notifications at 100. Music/cycle views remain subject to the project's configured row limit; full authorized JSON exports paginate. These view bounds do not delete underlying records. Large-history filtering/pagination on those secondary views is future work, not an implemented infinite archive.

## Private onboarding and presentation

`/onboarding` completes name, optional gender, locale/timezone and personal layout in an authenticated atomic RPC. `profile_preferences` is owner-only; gender is not a membership/authorization role. Auto suggests Dusk for male and Rose otherwise, with an override for every account. Navigation order varies without removing shared features. Private cycle navigation appears only after explicit tracking opt-in; existing private records remain accessible from settings for management/deletion.

Period dates never enter Auth metadata or the shared profile. Optional date/known-length entry can enable an explicitly approximate owner-only estimate. Unknown lengths save no prediction; irregular choices suppress it. Disabling tracking revokes minimal sharing/predictions/reminders while preserving history until explicit deletion.

`/pairing` offers two distinct paths: one account creates the space and a 15-minute 60-bit code, the other signs in and redeems it without first creating a competing space. Codes use domain-separated hashes and the existing transactional invitation boundary; links remain 48-hour/256-bit alternatives. Couple-before-invitation/profile-cascade locks prevent deletion/acceptance deadlocks. Pairing establishes durable account membership; the code is not a repeated chat login.
