import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  calendarMonth,
  formatDate,
  instantDate,
  localToUtc,
  nextOccurrence,
  relationshipDays,
  expandRecurring,
  todayISO,
} from '@/lib/dates';
import { estimatePeriod } from '@/lib/cycle';
describe('calendar and timezone behavior', () => {
  it('formats Persian calendar dates instead of transliterating a Gregorian month', () => {
    const date = formatDate('2026-03-21', 'fa', 'UTC');
    expect(date).toContain('فروردین');
    expect(date).toContain('۱۴۰۵');
  });
  it('uses the selected timezone across UTC date boundaries', () => {
    expect(instantDate('2026-01-01T01:00:00Z', 'America/Los_Angeles')).toBe('2025-12-31');
    expect(todayISO('Asia/Tokyo', Temporal.Instant.from('2026-10-24T23:00:00Z'))).toBe(
      '2026-10-25',
    );
  });
  it('rejects ambiguous and nonexistent DST input instead of silently moving an event', () => {
    expect(() => localToUtc('2026-03-29T01:30', 'Europe/London')).toThrow();
    expect(() => localToUtc('2026-10-25T01:30', 'Europe/London')).toThrow();
    expect(localToUtc('2026-10-25T03:30', 'Europe/London')).toBe('2026-10-25T03:30:00Z');
  });
  it('preserves weekly local time across spring and fall DST changes', () => {
    expect(nextOccurrence('2026-03-22T09:00:00Z', 'Europe/London', 'FREQ=WEEKLY')).toBe(
      '2026-03-29T08:00:00Z',
    );
    expect(nextOccurrence('2026-10-18T08:00:00Z', 'Europe/London', 'FREQ=WEEKLY')).toBe(
      '2026-10-25T09:00:00Z',
    );
  });
  it('counts calendar days, not 24-hour blocks across DST', () => {
    expect(
      relationshipDays(
        '2026-03-28',
        'Europe/London',
        Temporal.Instant.from('2026-03-30T00:30:00Z'),
      ),
    ).toBe(2);
  });
  it('builds a true Persian month starting on its own day 1 with a Saturday week', () => {
    const month = calendarMonth(new Date('2026-03-24T12:00:00Z'), 'fa');
    expect(month.first.toISOString().slice(0, 10)).toBe('2026-03-21');
    expect(month.days).toHaveLength(42);
    expect(month.days[0].iso).toBe('2026-03-21');
    expect(month.days[0].label).toBe('۱');
  });
  it('skips nonexistent month-days consistently with RFC 5545', () => {
    const events = expandRecurring(
      [
        {
          id: 'test',
          starts_at: '2026-01-31T09:00:00Z',
          ends_at: null,
          timezone: 'Europe/London',
          recurrence: 'FREQ=MONTHLY',
        },
      ],
      '2026-01-01T00:00:00Z',
      '2026-04-30T23:59:59Z',
    );
    expect(events.map((e) => e.starts_at)).toEqual([
      '2026-01-31T09:00:00Z',
      '2026-03-31T08:00:00Z',
    ]);
  });
  it('skips a nonexistent recurring wall-clock time, and chooses the later repeated time', () => {
    const spring = expandRecurring(
      [
        {
          id: 'test',
          starts_at: '2026-03-22T01:30:00Z',
          ends_at: null,
          timezone: 'Europe/London',
          recurrence: 'FREQ=WEEKLY',
        },
      ],
      '2026-03-28T00:00:00Z',
      '2026-03-30T00:00:00Z',
    );
    expect(spring).toEqual([]);
    const fall = expandRecurring(
      [
        {
          id: 'test',
          starts_at: '2026-10-18T00:30:00Z',
          ends_at: null,
          timezone: 'Europe/London',
          recurrence: 'FREQ=WEEKLY',
        },
      ],
      '2026-10-24T00:00:00Z',
      '2026-10-26T00:00:00Z',
    );
    expect(fall[0].starts_at).toBe('2026-10-25T01:30:00Z');
  });
});
describe('opt-in, explicitly approximate cycle estimates', () => {
  it('returns nothing when disabled or history is insufficient', () => {
    expect(estimatePeriod([{ start_date: '2026-01-01' }], true, 28)).toBeNull();
    expect(
      estimatePeriod([{ start_date: '2026-01-01' }, { start_date: '2026-01-29' }], false, 28),
    ).toBeNull();
  });
  it('uses the owner’s preference with two records, not invented certainty', () => {
    const result = estimatePeriod(
      [{ start_date: '2026-01-01' }, { start_date: '2026-01-31' }],
      true,
      29,
      true,
    );
    expect(result).toMatchObject({ date: '2026-03-01', basis: 'preference', length: 29 });
  });
  it('uses a median of valid personal history and flags variable intervals', () => {
    const result = estimatePeriod(
      [{ start_date: '2026-01-01' }, { start_date: '2026-01-29' }, { start_date: '2026-03-10' }],
      true,
      28,
    );
    expect(result?.basis).toBe('history');
    expect(result?.irregular).toBe(true);
    expect(result?.length).toBe(34);
  });
  it('does not manufacture predictions from duplicate or extremely sparse data', () => {
    expect(
      estimatePeriod([{ start_date: '2026-01-01' }, { start_date: '2026-01-01' }], true, 28),
    ).toBeNull();
    expect(
      estimatePeriod([{ start_date: '2025-01-01' }, { start_date: '2026-01-01' }], true, 28),
    ).toBeNull();
  });
  it('does not infer health outcomes or automatically advance a past estimate', () => {
    const result = estimatePeriod(
      [{ start_date: '2025-01-01' }, { start_date: '2025-01-29' }],
      true,
      28,
    );
    expect(result?.date).toBe('2025-02-26');
    expect(Object.keys(result!)).toEqual(['date', 'length', 'irregular', 'basis']);
  });
});

describe('all-day recurring event boundaries', () => {
  it('preserves exclusive local calendar days rather than a 24-hour duration across DST', () => {
    const result = expandRecurring(
      [
        {
          id: 'synthetic',
          starts_at: '2026-03-22T00:00:00Z',
          ends_at: '2026-03-23T00:00:00Z',
          timezone: 'Europe/London',
          recurrence: 'FREQ=WEEKLY',
          all_day: true,
        },
      ],
      '2026-03-29T00:00:00Z',
      '2026-03-30T00:00:00Z',
    );
    expect(result).toHaveLength(1);
    expect(result[0].starts_at).toBe('2026-03-29T00:00:00Z');
    expect(result[0].ends_at).toBe('2026-03-29T23:00:00Z');
  });
});
