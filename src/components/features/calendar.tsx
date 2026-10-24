'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import {
  CalendarDays,
  Plus,
  Clock3,
  MapPin,
  PenLine,
  Trash2,
  Repeat2,
  List,
  Check,
} from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  MembershipNotice,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Field,
  Select,
  Toggle,
  ConfirmButton,
  Badge,
} from '@/components/ui/primitives';
import { CalendarGrid } from '@/components/ui/calendar-grid';
import { useAction, useData } from '@/hooks/use-data';
import {
  formatDate,
  formatTime,
  utcToLocal,
  localToUtc,
  todayISO,
  instantDate,
  expandRecurring,
} from '@/lib/dates';
import { timezoneSchema } from '@/schemas/actions';
import type { Event } from '@/types/models';
const eventFormSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(4000),
  start: z.string().min(1),
  end: z.string(),
  timezone: timezoneSchema,
  location: z.string().max(200),
  recurrence: z.enum(['', 'FREQ=WEEKLY', 'FREQ=MONTHLY']),
});
function EventForm({ initial, onSaved }: { initial: Event | null; onSaved: () => void }) {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const [allDay, setAllDay] = useState(initial?.all_day || false);
  const [reminder, setReminder] = useState(initial?.reminder_enabled || false);
  const [done, setDone] = useState(initial?.status === 'done');
  const [dateError, setDateError] = useState('');
  const form = useForm({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: initial?.title || '',
      description: initial?.description || '',
      start: utcToLocal(
        initial?.starts_at || new Date().toISOString(),
        initial?.timezone || timezone,
      ),
      end: initial?.ends_at ? utcToLocal(initial.ends_at, initial.timezone) : '',
      timezone: initial?.timezone || timezone,
      location: initial?.location || '',
      recurrence: (initial?.recurrence || '') as '' | 'FREQ=WEEKLY' | 'FREQ=MONTHLY',
    },
  });
  const enabled = ws.configured && !!ws.couple;
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(async (values) => {
        setDateError('');
        let starts_at: string,
          ends_at: string | null = null;
        try {
          starts_at = localToUtc(
            allDay ? values.start.slice(0, 10) + 'T00:00' : values.start,
            values.timezone,
          );
          if (values.end)
            ends_at = localToUtc(
              allDay ? values.end.slice(0, 10) + 'T00:00' : values.end,
              values.timezone,
            );
          else if (allDay)
            ends_at = localToUtc(
              Temporal.PlainDate.from(values.start.slice(0, 10)).add({ days: 1 }).toString() +
                'T00:00',
              values.timezone,
            );
          if (ends_at && ends_at <= starts_at) throw new Error('order');
        } catch {
          setDateError(
            t(
              'زمان پایان باید بعد از شروع باشد. زمان‌های مبهم یا ناموجود تغییر ساعت تابستانی را انتخاب نکنید.',
              'End time must follow start. Choose times outside an ambiguous or nonexistent daylight-saving hour.',
            ),
          );
          return;
        }
        const result = await action.run({
          type: 'event.save',
          id: initial?.id,
          fields: {
            title: values.title,
            description: values.description,
            starts_at,
            ends_at,
            timezone: values.timezone,
            all_day: allDay,
            location: values.location,
            recurrence: values.recurrence || null,
            status: done ? 'done' : 'planned',
            reminder_enabled: reminder,
          },
        });
        if (result.ok) onSaved();
      })}
    >
      <Field
        label={t('اسم قرارمان', 'What shall we call our plan?')}
        error={
          form.formState.errors.title
            ? t('عنوان را وارد کن.', 'Give your plan a title.')
            : undefined
        }
      >
        <input
          {...form.register('title')}
          maxLength={120}
          disabled={!enabled}
          placeholder={t('مثلاً: یک عصر، فقط خودمان', 'An afternoon, just us')}
        />
      </Field>
      <div className="form-grid">
        <Field label={t('شروع', 'Starts')}>
          <input type="datetime-local" {...form.register('start')} disabled={!enabled} />
        </Field>
        <Field label={t('پایان (اختیاری)', 'Ends (optional)')}>
          <input type="datetime-local" {...form.register('end')} disabled={!enabled} />
        </Field>
        <Field
          label={t('منطقه‌ی زمانی رویداد', 'Event timezone')}
          error={
            form.formState.errors.timezone
              ? t('منطقه‌ی زمانی معتبر IANA وارد کنید.', 'Enter a valid IANA timezone.')
              : undefined
          }
          hint={t(
            'زمانِ محلی در تغییر ساعت تابستانی حفظ می‌شود.',
            'Recurrences preserve the event’s local wall-clock time.',
          )}
        >
          <input {...form.register('timezone')} list="timezones" disabled={!enabled} dir="ltr" />
          <datalist id="timezones">
            {[
              'Asia/Tehran',
              'Europe/London',
              'Europe/Berlin',
              'America/New_York',
              'America/Los_Angeles',
              'UTC',
            ].map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </Field>
        <Field label={t('تکرار', 'Repeats')}>
          <Select {...form.register('recurrence')} disabled={!enabled}>
            <option value="">{t('فقط همین بار', 'Just this once')}</option>
            <option value="FREQ=WEEKLY">
              {t('هر هفته، همین ساعت', 'Weekly, same local time')}
            </option>
            <option value="FREQ=MONTHLY">
              {t('هر ماه، همین روز و ساعت', 'Monthly, same day and time')}
            </option>
          </Select>
        </Field>
        <Field label={t('کجا؟ (اختیاری)', 'Where? (optional)')} className="span-full">
          <input {...form.register('location')} maxLength={200} disabled={!enabled} />
        </Field>
        <Field label={t('جزئیات کوچک', 'The little details')} className="span-full">
          <textarea
            {...form.register('description')}
            rows={3}
            maxLength={4000}
            disabled={!enabled}
          />
        </Field>
      </div>
      <div>
        <Toggle
          checked={allDay}
          onChange={setAllDay}
          disabled={!enabled}
          label={t('تمام روز', 'All day')}
          description={t(
            'زمان‌ها به نیمه‌شب در منطقه‌ی رویداد تبدیل می‌شوند؛ پایان غیرشامل است.',
            'Times become midnight in the event timezone; the end date is exclusive.',
          )}
        />
        <Toggle
          checked={reminder}
          onChange={setReminder}
          disabled={!enabled}
          label={t('یک ساعت قبل یادآوری کن', 'Remind us one hour before')}
          description={t(
            'با رعایت تنظیمات اعلان هر نفر؛ نیازمند زمان‌بندی سرور.',
            'Respects each person’s preferences; requires the server scheduler.',
          )}
        />
        {initial && (
          <Toggle
            checked={done}
            onChange={setDone}
            label={t('این برنامه انجام شد', 'We did this')}
            disabled={!enabled}
          />
        )}
      </div>
      {dateError && (
        <div className="inline-error" role="alert">
          {dateError}
        </div>
      )}
      <p className="field-hint">
        {t(
          'تکرار ماهانه، ماه‌های بدون آن روز را رد می‌کند؛ مثلاً روز ۳۱ در ماه ۳۰روزه جابه‌جا نمی‌شود.',
          'Monthly recurrence skips months without that day; the 31st never silently becomes the 30th.',
        )}
      </p>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onSaved}>
          {t('انصراف', 'Cancel')}
        </Button>
        <Button type="submit" busy={action.pending} disabled={!enabled}>
          <CalendarDays size={16} />
          {t('ذخیره‌ی قرار ما', 'Save our plan')}
        </Button>
      </div>
    </form>
  );
}
export function CalendarScreen({ createInitially = false }: { createInitially?: boolean }) {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const query = useData<Event[]>('events');
  const action = useAction();
  const [selected, setSelected] = useState(todayISO(timezone));
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [edit, setEdit] = useState<Event | null>(null);
  const [open, setOpen] = useState(createInitially);
  const from = Temporal.PlainDate.from(selected).subtract({ months: 1 }).toString() + 'T00:00:00Z';
  const to = Temporal.PlainDate.from(selected).add({ months: 2 }).toString() + 'T23:59:59Z';
  const occurrences = expandRecurring(query.data || [], from, to);
  const markers = occurrences.map((e) =>
    instantDate(e.starts_at, e.all_day ? e.timezone : timezone),
  );
  const events =
    view === 'list'
      ? occurrences
      : occurrences.filter(
          (e) => instantDate(e.starts_at, e.all_day ? e.timezone : timezone) === selected,
        );
  return (
    <>
      <PageHeader
        eyebrow="DAYS TO LOOK FORWARD TO"
        title={t('تقویم دونفره‌ی ما', 'Our little calendar')}
        description={t(
          'قرارها، روزهای خاص و بهانه‌هایی برای کنار هم بودن.',
          'Dates, special days, and reasons to be together.',
        )}
        action={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            {t('یک قرار تازه', 'Make a plan')}
          </Button>
        }
      />
      <SetupNotice />
      <MembershipNotice />
      <div className="tab-bar">
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>
          <CalendarDays size={14} style={{ display: 'inline', marginInlineEnd: 6 }} />
          {t('تقویم', 'Calendar')}
        </button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          <List size={14} style={{ display: 'inline', marginInlineEnd: 6 }} />
          {t('فهرست این بازه', 'This date range')}
        </button>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className={view === 'calendar' ? 'calendar-layout' : 'stack'}>
          {view === 'calendar' && (
            <CalendarGrid selected={selected} onSelect={setSelected} markers={markers} />
          )}
          <div>
            <div className="panel-header">
              <h2>
                {view === 'calendar'
                  ? formatDate(selected, locale, 'UTC')
                  : t(
                      'از یک ماه قبل تا دو ماه بعد از روز انتخابی',
                      'From one month before to two months after your chosen day',
                    )}
              </h2>
            </div>
            {events.length ? (
              events.map((event) => (
                <article className="event-card" key={event.occurrence_id}>
                  <div className="event-card-header">
                    <h3>{event.title}</h3>
                    {event.status === 'done' ? (
                      <Badge green>
                        <Check size={12} />
                        {t('انجام شد', 'Done')}
                      </Badge>
                    ) : event.recurrence ? (
                      <Repeat2 size={15} color="var(--dusty-rose)" />
                    ) : null}
                  </div>
                  <p>
                    <Clock3 size={13} />
                    {formatDate(
                      event.starts_at,
                      locale,
                      event.all_day ? event.timezone : timezone,
                      { year: undefined },
                    )}{' '}
                    ·{' '}
                    {event.all_day
                      ? t('تمام روز', 'All day')
                      : formatTime(event.starts_at, locale, event.timezone)}{' '}
                    <span dir="ltr">({event.timezone})</span>
                  </p>
                  {event.location && (
                    <p>
                      <MapPin size={13} />
                      {event.location}
                    </p>
                  )}
                  {event.description && <p>{event.description}</p>}
                  <div className="rsvp-row">
                    <span className="field-hint">{t('با هم؟', 'Together?')}</span>
                    {[
                      { id: 'yes', fa: 'هستم', en: 'I’m in' },
                      { id: 'maybe', fa: 'شاید', en: 'Maybe' },
                      { id: 'no', fa: 'این بار نه', en: 'Not this time' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        className={`filter-chip ${event.event_responses.some((v) => v.user_id === ws.userId && v.response === r.id) ? 'active' : ''}`}
                        onClick={() =>
                          void action.run({
                            type: 'event.rsvp',
                            id: event.id,
                            response: r.id as 'yes' | 'maybe' | 'no',
                          })
                        }
                      >
                        {t(r.fa, r.en)}
                      </button>
                    ))}
                  </div>
                  {event.event_responses
                    .filter((r) => r.user_id !== ws.userId)
                    .map((r) => (
                      <p key={r.user_id}>
                        {ws.members.find((m) => m.id === r.user_id)?.display_name}:{' '}
                        {r.response === 'yes'
                          ? t('هستم', 'I’m in')
                          : r.response === 'maybe'
                            ? t('شاید', 'Maybe')
                            : t('این بار نه', 'Not this time')}
                      </p>
                    ))}
                  {event.creator_id === ws.userId && (
                    <div className="event-actions">
                      <Button
                        variant="ghost"
                        className="small"
                        onClick={() => {
                          setEdit(query.data?.find((e) => e.id === event.id) || null);
                          setOpen(true);
                        }}
                      >
                        <PenLine size={13} />
                        {t('ویرایش برنامه', 'Edit series')}
                      </Button>
                      <ConfirmButton
                        variant="ghost"
                        title={t('این برنامه حذف شود؟', 'Delete this plan?')}
                        description={t(
                          'رویداد و تمام تکرارهای آن حذف می‌شوند.',
                          'This event and all of its recurrences will be removed.',
                        )}
                        onConfirm={async () => {
                          await action.run({ type: 'event.delete', id: event.id });
                        }}
                      >
                        <Trash2 size={13} />
                      </ConfirmButton>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="panel">
                <EmptyState
                  compact
                  icon={CalendarDays}
                  title={t('این روز، جای یک قرار دارد.', 'This day has room for a little plan.')}
                  description={t(
                    'قهوه، پیاده‌روی، یا کاری که مدت‌هاست منتظرش هستید.',
                    'Coffee, a walk, or that thing you’ve been meaning to do.',
                  )}
                  action={
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEdit(null);
                        setOpen(true);
                      }}
                    >
                      <Plus size={14} />
                      {t('برنامه‌اش را بچینیم', 'Let’s make a plan')}
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          edit
            ? t('ویرایش قرارمان', 'Edit our plan')
            : t('یک بهانه‌ی تازه برای با هم بودن', 'A new reason to be together')
        }
        wide
      >
        <EventForm initial={edit} onSaved={() => setOpen(false)} />
      </Modal>
    </>
  );
}
