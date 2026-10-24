import { Temporal } from '@js-temporal/polyfill';
export interface PeriodInput {
  start_date: string;
  end_date?: string | null;
}
export function estimatePeriod(
  records: PeriodInput[],
  enabled: boolean,
  preferredLength: number,
  manualLengthConfirmed = false,
  cyclesIrregular = false,
) {
  if (
    !enabled ||
    cyclesIrregular ||
    !Number.isInteger(preferredLength) ||
    preferredLength < 15 ||
    preferredLength > 90
  )
    return null;
  const dates = [...new Set(records.map((record) => record.start_date))].sort();
  if (!dates.length || (!manualLengthConfirmed && dates.length < 2)) return null;
  const intervals = dates
    .slice(1)
    .map(
      (date, index) =>
        Temporal.PlainDate.from(dates[index]).until(Temporal.PlainDate.from(date)).days,
    )
    .filter((days) => days >= 15 && days <= 90)
    .slice(-6);
  if (!intervals.length && !manualLengthConfirmed) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const median =
    sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  const length = manualLengthConfirmed ? preferredLength : median;
  return {
    date: Temporal.PlainDate.from(dates.at(-1)!).add({ days: length }).toString(),
    length,
    irregular: intervals.length > 1 && Math.max(...intervals) - Math.min(...intervals) > 9,
    basis: manualLengthConfirmed ? ('preference' as const) : ('history' as const),
  };
}
