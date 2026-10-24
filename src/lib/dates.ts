import { Temporal } from '@js-temporal/polyfill';
export type Locale = 'fa' | 'en';
export function formatDate(
  value: string | Date,
  locale: Locale,
  timezone = 'UTC',
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(new Date(value));
}
export function formatTime(value: string, locale: Locale, timezone: string) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function localToUtc(local: string, timezone: string): string {
  const plain = Temporal.PlainDateTime.from(local);
  return plain.toZonedDateTime(timezone, { disambiguation: 'reject' }).toInstant().toString();
}
export function utcToLocal(value: string, timezone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}
export function todayISO(timezone: string, now = Temporal.Now.instant()) {
  return now.toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function relationshipDays(start: string, timezone: string, now = Temporal.Now.instant()) {
  return Math.max(
    0,
    Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(todayISO(timezone, now))).days,
  );
}
export function nextOccurrence(start: string, timezone: string, rule: string | null) {
  if (!rule) return null;
  const zoned = Temporal.Instant.from(start).toZonedDateTimeISO(timezone);
  return zoned
    .add(rule === 'FREQ=WEEKLY' ? { weeks: 1 } : { months: 1 })
    .toInstant()
    .toString();
}
export function calendarMonth(anchor: Date, locale: Locale) {
  const calendar = locale === 'fa' ? 'persian' : 'gregory';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    calendar,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = (date: Date) =>
    Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const current = parts(anchor);
  const first = new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() - Number(current.day) + 1,
    ),
  );
  const days: { iso: string; label: string; inMonth: boolean }[] = [];
  const offset = (first.getUTCDay() - (locale === 'fa' ? 6 : 1) + 7) % 7;
  for (let i = -offset; i < 42 - offset; i++) {
    const d = new Date(first);
    d.setUTCDate(first.getUTCDate() + i);
    const p = parts(d);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-GB').format(Number(p.day)),
      inMonth: p.month === current.month,
    });
  }
  const previous = new Date(first);
  previous.setUTCDate(0);
  const next = new Date(first);
  next.setUTCDate(first.getUTCDate() + 35);
  return {
    days,
    first,
    previous,
    next,
    title: formatDate(first, locale, 'UTC', { day: undefined, month: 'long', year: 'numeric' }),
  };
}
export function instantDate(value: string, timezone: string) {
  return Temporal.Instant.from(value).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function expandRecurring<
  T extends {
    id: string;
    starts_at: string;
    ends_at: string | null;
    timezone: string;
    recurrence: string | null;
    all_day?: boolean;
  },
>(events: T[], from: string, to: string) {
  const result: (T & { occurrence_id: string })[] = [];
  for (const event of events) {
    const base = Temporal.Instant.from(event.starts_at).toZonedDateTimeISO(event.timezone);
    const end = event.ends_at ? Temporal.Instant.from(event.ends_at) : null;
    const duration = end ? Temporal.Instant.from(event.starts_at).until(end) : null;
    const allDayLength =
      end && event.all_day
        ? base.toPlainDate().until(end.toZonedDateTimeISO(event.timezone).toPlainDate()).days
        : null;
    for (let index = 0; index < 2400; index++) {
      const plain =
        index === 0
          ? base.toPlainDateTime()
          : base
              .toPlainDateTime()
              .add(event.recurrence === 'FREQ=WEEKLY' ? { weeks: index } : { months: index });
      const local = plain.toZonedDateTime(event.timezone, { disambiguation: 'later' });
      const instant = local.toInstant();
      const iso = instant.toString();
      if (Temporal.Instant.compare(instant, Temporal.Instant.from(to)) > 0) break;
      // RFC 5545: an invalid month-day is skipped, not silently moved to a different day.
      if (
        local.toPlainDateTime().equals(plain) &&
        (!event.recurrence || event.recurrence !== 'FREQ=MONTHLY' || local.day === base.day) &&
        Temporal.Instant.compare(instant, Temporal.Instant.from(from)) >= 0
      ) {
        result.push({
          ...event,
          starts_at: iso,
          ends_at:
            allDayLength !== null
              ? local.add({ days: allDayLength }).toInstant().toString()
              : duration
                ? instant.add(duration).toString()
                : null,
          occurrence_id: `${event.id}:${iso}`,
        });
      }
      if (!event.recurrence) break;
    }
  }
  return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
