'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useI18n } from '@/components/providers';
import { calendarMonth, todayISO } from '@/lib/dates';
export function CalendarGrid({
  selected,
  onSelect,
  markers = [],
  periodDays = [],
}: {
  selected: string;
  onSelect: (date: string) => void;
  markers?: string[];
  periodDays?: string[];
}) {
  const { t, locale, timezone } = useI18n();
  const [anchor, setAnchor] = useState(() => new Date(selected + 'T12:00:00Z'));
  const month = calendarMonth(anchor, locale);
  const today = todayISO(timezone);
  const weekdays =
    locale === 'fa' ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="panel calendar-panel">
      <div className="calendar-nav">
        <h2>{month.title}</h2>
        <div>
          <button
            className="icon-button"
            aria-label={t('ماه قبل', 'Previous month')}
            onClick={() => {
              setAnchor(month.previous);
              onSelect(calendarMonth(month.previous, locale).first.toISOString().slice(0, 10));
            }}
          >
            {locale === 'fa' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label={t('ماه جاری', 'Current month')}
            onClick={() => {
              setAnchor(new Date(today + 'T12:00:00Z'));
              onSelect(today);
            }}
          >
            <CalendarDays size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={t('ماه بعد', 'Next month')}
            onClick={() => {
              setAnchor(month.next);
              onSelect(calendarMonth(month.next, locale).first.toISOString().slice(0, 10));
            }}
          >
            {locale === 'fa' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {weekdays.map((day, i) => (
          <span className="weekday" key={i} aria-hidden="true">
            {day}
          </span>
        ))}
        {month.days.map((day) => (
          <button
            key={day.iso}
            className={`calendar-day ${!day.inMonth ? 'outside' : ''} ${day.iso === today ? 'today' : ''} ${day.iso === selected ? 'selected' : ''} ${periodDays.includes(day.iso) ? 'has-period' : ''}`}
            onClick={() => onSelect(day.iso)}
            aria-pressed={day.iso === selected}
            aria-current={day.iso === today ? 'date' : undefined}
            aria-label={new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
              dateStyle: 'full',
              timeZone: 'UTC',
            }).format(new Date(day.iso))}
          >
            {day.label}
            {markers.includes(day.iso) && <span className="day-dot" />}
          </button>
        ))}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-dot" />
          {periodDays.length
            ? t('روزهای ثبت‌شده‌ی شخصی', 'Your recorded days')
            : t('یک برنامه‌ی مشترک', 'A shared plan')}
        </span>
        <span>
          {t(
            'تاریخ‌ها با تقویم انتخابی نمایش داده می‌شوند.',
            'Dates follow your selected calendar.',
          )}
        </span>
      </div>
    </div>
  );
}
