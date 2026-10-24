# Android and iOS

## What is provided—and what is not

Included Capacitor platform **source** projects, branded icon/splash assets, nine plugins, a trusted remote HTTPS shell, an explicit setup/offline fallback, invite deep-link handlers (warm and cold launch), foreground/network refetch, keyboard/status-bar configuration, microphone and notification declarations, token registration/revocation, and a cache-only export/share adapter.

The native projects have been generated and synced, **not compiled or device-tested in this Linux environment**. There is no APK/AAB/IPA release, signing configuration, App Store approval or native push delivery proof. The manual GitHub native workflow is an unexecuted build definition, not evidence of a successful native build.

The Next.js server/API cannot be statically exported into Capacitor. The configured shell loads the operator's HTTPS deployment. This architecture requires connectivity and a trustworthy web origin; it is not an offline-first native database or a guarantee of store acceptance.

## Prerequisites

- Node/npm matching the repository, `npm ci`.
- An already configured, trusted HTTPS staging/production web deployment with Auth redirect settings and the eight migrations.
- Android: JDK **21**, Android Studio/SDK **36**, accepted SDK licenses, Android device/emulator. Minimum supported Android API is **24**. The committed Gradle wrapper is 8.14.3 and Android Gradle Plugin 8.13.0.
- iOS: **macOS and a compatible Xcode**, iOS 15+ target, simulator/device, Swift Package Manager dependency access. A physical release needs an Apple Developer team, valid bundle ID, profiles/entitlements and signing outside Git.
- Real-device microphone/network/push testing. A desktop Chromium mobile viewport is not an iPhone/WebView test.

## Choose identifiers and trusted origin

Initial placeholders are `com.example.himandi` and `himandi.example`; they are not claimed as real registrations.

1. Choose your own reverse-DNS app identifier and domain.
2. In Android Studio, refactor `com.example.himandi`, including `MainActivity.java` and its package path; update `namespace` and `applicationId` in `android/app/build.gradle`. Check manifest references.
3. In Xcode, change both build configurations' `PRODUCT_BUNDLE_IDENTIFIER` and select the real team. Check signing entitlements.
4. Set the matching `CAPACITOR_APP_ID` and your real `CAPACITOR_SERVER_URL` in ignored `.env.local`, or supply them as environment variables. The sync script validates that both committed native identifiers match; changing only an environment variable is not a native rename.
5. Run:

```sh
npm run native:sync
```

Only HTTPS origins without embedded credentials are accepted. Use a domain you control; never ship an ephemeral/untrusted preview origin. Navigation allowlists stay limited to that configured host. With no remote origin, the app deliberately packages a data-free setup screen and does not simulate an account.

`native:sync` copies the bundled fallbacks, updates plugin wiring, and substitutes the configured host into Android invite links and iOS associated-domain entitlements. Generated web/config files remain ignored. Run sync after installing dependencies or changing native configuration. Regenerate branded images with `npm run native:assets` if design assets change.

## Build Android

```sh
npm ci
npm run native:sync
npm run native:android
# Android Studio: select a device, then Run.

# Command line, with JDK/SDK configured:
cd android
./gradlew :app:assembleDebug :app:lintDebug --no-daemon
# Output: app/build/outputs/apk/debug/app-debug.apk
```

These commands are instructions, not claimed completed builds. `local.properties`, signing keystores, provider files and build outputs are ignored. Release signing must be configured with an external keystore/secret store; do not commit it or upload it to chat. Increment versionCode/versionName and complete Play Console disclosures before distribution. The app disables Android backup and cleartext traffic, requests microphone/notification permissions, and exposes only the `exports/` app-cache directory through FileProvider—not a broad filesystem path.

## Build iOS

On macOS:

```sh
npm ci
npm run native:sync
npm run native:ios
# Open ios/App/App.xcodeproj, resolve Swift packages, select a simulator and build.

# Unsigned simulator compile:
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Choose a signing team/profile for a real device/archive. Entitlements currently use the **development** APNs environment; use the correct production entitlement/profile for distribution. ATS does not allow arbitrary loads. `Info.plist` declares Persian/English and a user-facing microphone reason. `PrivacyInfo.xcprivacy` is included as an app resource and declares Filesystem's file-timestamp required-API reason; Capacitor's own manifests come from its package. This is not a completed App Store health-data disclosure. Review the final dependency manifests and accurately declare collected/stored data in App Store Connect.

## Invite links and email

- Android manifest: HTTPS `/invite/` app links and `himandi://invite/<token>`.
- iOS: associated HTTPS domain and the `himandi` URL scheme.
- The bridge accepts only the configured HTTPS origin's invite path or the exact custom invite scheme/host. The token is still validated by the application and requires a signed-in account plus transactional membership acceptance.
- Publish `/.well-known/assetlinks.json` on the real domain using the **actual** Android app ID/signing certificate fingerprint, and `/.well-known/apple-app-site-association` using the **actual** Apple team ID and bundle ID. No invented association IDs/files have been shipped. Use a narrow invite-path association and test after real signing.
- Custom URL schemes are not proof of app ownership; prefer verified HTTPS links. Redact invite tokens from device/host diagnostics.
- Supabase email opened in another browser does not share WebView cookies. Configure the token-hash email templates in `DEPLOYMENT.md`; after confirmation, return to the app and sign in. Test password recovery as a real device flow rather than assuming PKCE verifiers transfer between browsers.

## Permissions, exports and notification boundaries

Voice uses MediaRecorder only after a user action and stops tracks on completion/unmount. Unsupported codecs/devices and denied microphone access get a real error instead of a fake recording. Files are selected via the browser/WebView's system picker; no broad storage permission is requested. Safari/Android codec and permission behavior remains a device acceptance test.

Explicit data export uses Capacitor Filesystem's cache directory and Share. Files are deleted after sharing and startup clears interrupted-share leftovers; the operator must verify this timing with actual share targets. If the OS kills the app mid-share, a leftover may remain in its private cache until next launch/OS cleanup. Exporting/sharing sensitive data is a user's explicit decision; recipients/shared copies cannot be remotely erased.

Web Push has an implemented optional VAPID worker. Native APNs/FCM registration listeners and source hooks are provided, but the server currently delivers **only Web Push**. To finish native delivery, implement a trusted provider adapter, secret handling, preference/revocation rechecks, token-expiry handling, retries, generic payloads and signed-device tests. Android also needs the ignored operator-supplied `google-services.json`; Apple needs APNs/team/key configuration outside source control. Merely seeing a registration token is not successful delivery.

`@capacitor/local-notifications` is wired/configured but **the app does not schedule local reminders**. All implemented reminders use the trusted server job. This avoids silently placing health schedules on a shared device. If local reminders are added, make owner-only consent, discreet content, timezone/DST behavior and cancellation on consent revocation/account deletion explicit and tested.

## Device acceptance checklist

- Fresh install, configured/unconfigured/offline launch, no private offline cache, safe-area/keyboard/layout on small/large devices.
- Persian RTL and English LTR, VoiceOver/TalkBack, dynamic text, keyboard focus and reduced motion.
- Signup, real email confirmation, password recovery, session refresh/expiry, this-device/all-device logout, multi-tab/WebView session behavior.
- Warm/cold valid/invalid/replayed invite links, returning from external browser, domain association verification.
- Two devices in one space plus an unrelated third account: authenticated chat events, reconnect, ordering/retry, read receipts only at the visible bottom, deletion and attachment access boundaries.
- Microphone grant/deny/revoke/background interruption; WebM/M4A playback and seeking past 60 seconds; file picker, upload progress, 4 MiB/type/duration rejection and failed-upload recovery.
- Calendar wall times/all-day boundaries through DST, stored timezone changes, scheduled-letter denial before release, process/app restart at release.
- Owner-private cycle defaults, separate sharing toggles, revocation/deletion, no health information in shared dashboard, push payloads, OS snapshots/logs or unintended export scopes.
- Notification permission denial, registration, real provider delivery when adapters exist, expired/revoked tokens, logout/preferences cleanup.
- Account/cycle export/share cancel/failure/success and temporary-file cleanup; account deletion with attachment-only chat and queued physical cleanup.
- Signed release install/update, association files, APNs environment, provider secrets, backup/disclosure review. Do not label this complete until actual results are recorded.
