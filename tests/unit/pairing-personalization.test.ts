import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { normalizePairingCode, formatPairingCode, pairingPattern } from '@/lib/pairing';
import { generatePairingCode, hashPairingCode } from '@/lib/server/pairing';
import { personalTheme, personalNavigation } from '@/lib/personalization';
import { actionSchema, authSchema, profileSetupFields } from '@/schemas/actions';
import { estimatePeriod } from '@/lib/cycle';
const fields = {
  display_name: 'Synthetic person',
  gender: 'female',
  layout: 'auto',
  locale: 'fa',
  timezone: 'UTC',
  cycle_tracking: false,
  period_start: null,
  reported_length: null,
  irregular: false,
};
describe('private pairing codes', () => {
  it('normalizes case, separators and Persian/Arabic digits', () => {
    expect(normalizePairingCode('۲abc-۳def ٤ghj')).toBe('2ABC3DEF4GHJ');
    expect(formatPairingCode('2abc3def4ghj')).toBe('2ABC-3DEF-4GHJ');
  });
  it('generates unique 60-bit code strings with separate non-reversible hashes', () => {
    const generated = Array.from({ length: 32 }, () => generatePairingCode());
    expect(new Set(generated.map((value) => value.code)).size).toBe(32);
    for (const value of generated) {
      expect(pairingPattern.test(normalizePairingCode(value.code))).toBe(true);
      expect(value.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hashPairingCode(value.code.toLowerCase())).toBe(value.hash);
      expect(value.hash).not.toContain(value.code);
    }
  });
  it.each(['123456', '0000-1111-OOOO', '2ABC3DEF4GHJEXTRA', '2ABC_3DEF_4GHJ'])(
    'rejects malformed/ambiguous code %s',
    (code) => {
      expect(actionSchema.safeParse({ type: 'invitation.code.accept', code }).success).toBe(false);
    },
  );
});
describe('owner-controlled presentation and health consent', () => {
  it('suggests different layouts without restricting either account’s shared features', () => {
    expect(personalTheme('male', 'auto')).toBe('dusk');
    expect(personalTheme('female', 'auto')).toBe('rose');
    expect(personalTheme('female', 'dusk')).toBe('dusk');
    expect(personalTheme('male', 'rose')).toBe('rose');
    expect(new Set(personalNavigation('dusk', false))).toEqual(
      new Set(personalNavigation('rose', false)),
    );
  });
  it('shows cycle navigation only after a separate opt-in, regardless of gender', () => {
    expect(personalNavigation('dusk', false)).not.toContain('/cycle');
    expect(personalNavigation('rose', false)).not.toContain('/cycle');
    expect(personalNavigation('dusk', true)).toContain('/cycle');
  });
  it('permits skipping health data entirely', () => {
    expect(profileSetupFields.safeParse(fields).success).toBe(true);
  });
  it('requires tracking consent and a known length for a single-date estimate', () => {
    expect(
      profileSetupFields.safeParse({ ...fields, period_start: '2026-06-01', reported_length: 28 })
        .success,
    ).toBe(false);
    expect(
      profileSetupFields.safeParse({ ...fields, cycle_tracking: true, period_start: '2026-06-01' })
        .success,
    ).toBe(true);
    expect(
      profileSetupFields.safeParse({
        ...fields,
        cycle_tracking: true,
        period_start: '2026-06-01',
        irregular: true,
      }).success,
    ).toBe(true);
  });
  it('keeps health fields out of signup/Auth metadata input', () => {
    const parsed = authSchema.parse({
      type: 'signup',
      email: 'fixture@example.com',
      password: 'synthetic long passphrase',
      display_name: 'Fixture',
      gender: 'female',
      period_start: '2026-06-01',
      reported_length: 28,
    });
    expect(parsed).not.toHaveProperty('period_start');
    expect(parsed).not.toHaveProperty('reported_length');
  });
  it('calculates a clearly preference-based estimate from one date only after explicit confirmation', () => {
    expect(estimatePeriod([{ start_date: '2026-06-01' }], true, 29)).toBeNull();
    expect(estimatePeriod([{ start_date: '2026-06-01' }], true, 29, true)).toEqual({
      date: '2026-06-30',
      length: 29,
      irregular: false,
      basis: 'preference',
    });
  });
  it('does not predict when disabled, irregular, missing a date, or given invalid lengths', () => {
    expect(estimatePeriod([{ start_date: '2026-06-01' }], false, 29, true)).toBeNull();
    expect(estimatePeriod([{ start_date: '2026-06-01' }], true, 29, true, true)).toBeNull();
    expect(estimatePeriod([], true, 29, true)).toBeNull();
    expect(estimatePeriod([{ start_date: '2026-06-01' }], true, 5, true)).toBeNull();
  });
});
