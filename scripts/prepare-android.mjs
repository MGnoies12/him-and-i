import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const origin = process.env.CAPACITOR_SERVER_URL || '';
const mode = origin ? 'configured' : 'setup';
if (origin) {
  const url = new URL(origin);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'CAPACITOR_SERVER_URL must be a trusted HTTPS origin, without credentials/path/query.',
    );
  }
  const response = await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  if (!response.ok || health.ready !== true) {
    throw new Error(
      'The deployment is not ready. Configure Supabase/server secrets and apply the migrations before building a configured APK.',
    );
  }
}
const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
const attempt = Number(process.env.GITHUB_RUN_ATTEMPT || 1);
const code = 10000 + run * 100 + attempt;
if (!Number.isSafeInteger(code) || code > 2100000000 || run < 1 || attempt < 1 || attempt >= 100)
  throw new Error('Invalid build version.');
const gradle = 'android/app/build.gradle';
let source = readFileSync(gradle, 'utf8');
source = source.replace(/versionCode\s+\d+/, `versionCode ${code}`);
source = source.replace(/versionName\s+"[^"]+"/, `versionName "0.2.${run}.${attempt}"`);
writeFileSync(gradle, source);
const metadata = {
  app: 'HIM & I',
  mode,
  version: `0.2.${run}.${attempt}`,
  commit: process.env.GITHUB_SHA || 'local',
  origin: origin || null,
  signing: 'debug, testing only',
  built_at: new Date().toISOString(),
};
mkdirSync('out/android', { recursive: true });
writeFileSync('out/android/build-info.json', JSON.stringify(metadata, null, 2) + '\n');
const setupWarning =
  mode === 'setup'
    ? '**این APK هنوز به سرور متصل نیست؛ ثبت‌نام و چت آنلاین فعال نیست.** این نسخه فقط نصب و پوستهٔ اندروید را آزمایش می‌کند.\n\n**Setup-only APK: no online signup/chat until a trusted deployment is configured and a configured APK is rebuilt.**'
    : '**این APK به آدرس HTTPS تنظیم‌شده متصل است.** آماده بودن تنظیمات بررسی شده، اما تست واقعی دو گوشی و سرویس‌های ایمیل/اعلان همچنان ضروری است.\n\nThis APK targets the configured HTTPS deployment. Configuration readiness is checked, not full device/provider behavior.';
writeFileSync(
  'out/android/RELEASE_NOTES.md',
  `# HIM & I — Android preview\n\n${setupWarning}\n\n- یک APK برای هر دو نفر؛ هر نفر حساب خودش را می‌سازد.\n- Android 7+ (API 24), debug-signed for sideload testing, not a Play Store release.\n- CI debug keys are temporary. A different build may require uninstalling the previous one; stable updates need an operator-managed release key.\n- No provider secrets or personal data are bundled. Period records remain owner-private.\n- Source commit: ${metadata.commit}\n- Setup guide: https://github.com/MGnoies12/him-and-i/blob/${metadata.commit}/docs/SETUP.fa.md\n- Verify the APK with SHA256SUMS.txt.\n`,
);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${mode}\n`);
console.log(`Preparing ${mode} Android preview. No store-release or hosted-chat claim.`);
