import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Environment may be supplied directly. */
}
const origin = process.env.CAPACITOR_SERVER_URL;
if (origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Use a trusted HTTPS origin without credentials.');
}
const appId = process.env.CAPACITOR_APP_ID || 'com.example.himandi';
if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){2,}$/.test(appId))
  throw new Error('Use a reverse-DNS application identifier.');
const escaped = appId.replaceAll('.', '\\.');
const androidId = new RegExp(`applicationId\\s*(?:=\\s*)?["']${escaped}["']`);
const iosId = new RegExp(`PRODUCT_BUNDLE_IDENTIFIER\\s*=\\s*"?${escaped}"?;`);
if (
  !androidId.test(readFileSync('android/app/build.gradle', 'utf8')) ||
  !iosId.test(readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8'))
) {
  throw new Error(
    'CAPACITOR_APP_ID must match the committed Android and iOS identifiers. Rename them in Android Studio/Xcode first; see docs/MOBILE.md.',
  );
}
const result = spawnSync('npx', ['cap', 'sync'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
if (result.status !== 0) process.exit(result.status || 1);
if (origin) {
  const host = new URL(origin).hostname;
  const manifest = 'android/app/src/main/AndroidManifest.xml';
  if (existsSync(manifest)) {
    let text = readFileSync(manifest, 'utf8');
    text = text.replace(
      /android:host="[^"]+" android:pathPrefix="\/invite\/"/g,
      `android:host="${host}" android:pathPrefix="/invite/"`,
    );
    writeFileSync(manifest, text);
  }
  const entitlements = 'ios/App/App/App.entitlements';
  if (existsSync(entitlements)) {
    let text = readFileSync(entitlements, 'utf8');
    text = text.replace(/applinks:[^<]+/g, `applinks:${host}`);
    writeFileSync(entitlements, text);
  }
}
console.log(
  origin
    ? 'Native platforms synced to the explicitly configured HTTPS origin.'
    : 'Native platforms synced in fail-closed setup mode. No remote origin configured.',
);
