import { Temporal } from '@js-temporal/polyfill';
export interface PeriodInput {
  start_date: string;
  end_date?: string | null;
}
export function estimatePeriod(records: PeriodInput[], enabled: boolean, preferredLength: number) {
  if (!enabled || records.length < 2) return null;
  const dates = [...new Set(records.map((r) => r.start_date))].sort();
  if (dates.length < 2) return null;
  const intervals = dates
    .slice(1)
    .map((date, i) => Temporal.PlainDate.from(dates[i]).until(Temporal.PlainDate.from(date)).days)
    .filter((d) => d >= 15 && d <= 90)
    .slice(-6);
  if (!intervals.length) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const median =
    sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  const length = intervals.length >= 2 ? median : preferredLength;
  return {
    date: Temporal.PlainDate.from(dates.at(-1)!).add({ days: length }).toString(),
    length,
    irregular: Math.max(...intervals) - Math.min(...intervals) > 9,
    basis: intervals.length >= 2 ? ('history' as const) : ('preference' as const),
  };
}
