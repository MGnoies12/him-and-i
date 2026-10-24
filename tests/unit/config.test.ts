import { describe, it, expect } from 'vitest';
import { parsePublicConfig, safeRedirect, safeExternalLink } from '@/lib/config';
import { isAllowedPushEndpoint } from '@/lib/push';
const jwt = (role: string) => `${btoa('{}')}.${btoa(JSON.stringify({ role }))}.test-signature`;
describe('fail-closed public configuration', () => {
  it('requires both a URL and public key', () => {
    expect(parsePublicConfig({})).toBeNull();
    expect(parsePublicConfig({ url: 'https://example.supabase.co' })).toBeNull();
    expect(parsePublicConfig({ url: 'not a URL', key: 'sb_publishable_test' })).toBeNull();
  });
  it('accepts publishable and legacy anon keys, but never server credentials', () => {
    expect(
      parsePublicConfig({ url: 'https://example.supabase.co', key: 'sb_publishable_test' }),
    ).toEqual({ url: 'https://example.supabase.co', key: 'sb_publishable_test' });
    expect(
      parsePublicConfig({ url: 'https://example.supabase.co', key: jwt('anon') }),
    ).not.toBeNull();
    expect(
      parsePublicConfig({ url: 'https://example.supabase.co', key: 'sb_secret_test' }),
    ).toBeNull();
    expect(
      parsePublicConfig({ url: 'https://example.supabase.co', key: jwt('service_role') }),
    ).toBeNull();
    expect(
      parsePublicConfig({ url: 'https://example.supabase.co', key: 'broken.token.value' }),
    ).toBeNull();
  });
  it('requires HTTPS except local Supabase development', () => {
    expect(parsePublicConfig({ url: 'http://example.com', key: 'sb_publishable_test' })).toBeNull();
    expect(parsePublicConfig({ url: 'http://127.0.0.1:54321', key: jwt('anon') })).not.toBeNull();
  });
});
describe('redirect and push URL boundaries', () => {
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/home\r\nLocation: evil',
  ])('rejects an unsafe redirect %s', (value) => {
    expect(safeRedirect(value)).toBe('/home');
  });
  it('preserves relative invite destinations without granting access', () => {
    expect(safeRedirect('/invite/' + 'A'.repeat(43))).toBe('/invite/' + 'A'.repeat(43));
    expect(safeRedirect('/home?tab=ours')).toBe('/home?tab=ours');
  });
  it.each([
    'http://fcm.googleapis.com/push',
    'https://127.0.0.1/',
    'https://localhost/secret',
    'https://fcm.googleapis.com.evil.example/push',
    'https://user:pass@fcm.googleapis.com/push',
    'https://fcm.googleapis.com:444/push',
    'https://169.254.169.254/latest/meta-data',
  ])('rejects a push SSRF target %s', (value) => expect(isAllowedPushEndpoint(value)).toBe(false));
  it('accepts only approved HTTPS push providers', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/test')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test')).toBe(
      true,
    );
    expect(isAllowedPushEndpoint('https://web.push.apple.com/test')).toBe(true);
  });
});

describe('saved external links', () => {
  it('never throws or renders executable, credentialed, malformed or control-character links', () => {
    for (const value of [
      'broken',
      'javascript:alert(1)',
      'https://user:pass@example.com/',
      'https://example.com/white space',
      'https://example.com/' + String.fromCharCode(10) + 'path',
    ])
      expect(safeExternalLink(value)).toBeNull();
    expect(safeExternalLink('https://music.example.com/song?id=1')?.hostname).toBe(
      'music.example.com',
    );
  });
});
