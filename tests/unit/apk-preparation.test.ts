import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = pathToFileURL(resolve('scripts/prepare-android.mjs')).href;
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'him-i-apk-test-'));
  mkdirSync(join(directory, 'android/app'), { recursive: true });
  writeFileSync(
    join(directory, 'android/app/build.gradle'),
    'versionCode 1\nversionName "0.1.0"\n',
  );
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function prepare(origin = '', ready = true, overrides: Record<string, string> = {}) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `globalThis.fetch=async()=>({ok:${ready},json:async()=>({ready:${ready}})});await import(${JSON.stringify(script)});`,
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        NODE_ENV: 'test',
        CAPACITOR_SERVER_URL: origin,
        GITHUB_SHA: 'synthetic-source-commit',
        GITHUB_RUN_NUMBER: '12',
        GITHUB_RUN_ATTEMPT: '3',
        GITHUB_OUTPUT: join(directory, 'step-output'),
        ...overrides,
      },
    },
  );
}
describe('APK preparation and truthful release labels', () => {
  it('creates explicitly setup-only metadata and versioning without touching production services', () => {
    expect(prepare().status).toBe(0);
    expect(
      JSON.parse(readFileSync(join(directory, 'out/android/build-info.json'), 'utf8')),
    ).toMatchObject({
      mode: 'setup',
      origin: null,
      version: '0.2.12.3',
      version_code: 11203,
      signing: 'debug, testing only',
    });
    expect(readFileSync(join(directory, 'android/app/build.gradle'), 'utf8')).toContain(
      'versionCode 11203',
    );
    expect(readFileSync(join(directory, 'out/android/RELEASE_NOTES.md'), 'utf8')).toContain(
      'Setup-only APK: no online signup/chat',
    );
  });
  it('only labels a valid origin configured after a positive health result', () => {
    expect(prepare('https://synthetic.example').status).toBe(0);
    expect(
      JSON.parse(readFileSync(join(directory, 'out/android/build-info.json'), 'utf8')).mode,
    ).toBe('configured');
  });
  it('fails before packaging metadata if readiness fails', () => {
    expect(prepare('https://synthetic.example', false).status).not.toBe(0);
    expect(existsSync(join(directory, 'out/android/build-info.json'))).toBe(false);
  });
  it.each([
    'http://synthetic.example',
    'https://user:synthetic-password@example.com',
    'https://example.com/private?token=synthetic',
    'private synthetic token',
  ])('rejects unsafe origin %s without printing its value', (origin) => {
    const result = prepare(origin);
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain(origin);
  });
  it('rejects invalid CI version counters', () => {
    expect(prepare('', true, { GITHUB_RUN_NUMBER: '1.1' }).status).not.toBe(0);
    expect(prepare('', true, { GITHUB_RUN_ATTEMPT: '100' }).status).not.toBe(0);
  });
});
