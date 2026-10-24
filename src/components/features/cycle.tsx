'use client';
import { ExportButton } from '@/components/ui/data-export';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
import Link from 'next/link';
import {
  Flower2,
  LockKeyhole,
  ShieldCheck,
  Plus,
  PenLine,
  Trash2,
  Download,
  Bell,
  Heart,
  Info,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import { useAction, useData } from '@/hooks/use-data';
import {
  PageHeader,
  SetupNotice,
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
import { formatDate, formatTime, todayISO, localToUtc, utcToLocal } from '@/lib/dates';
import { estimatePeriod } from '@/lib/cycle';
import type { CycleData } from '@/types/models';
import type { Row } from '@/types/database';
const periodSchema = z.object({
  start_date: z.iso.date(),
  end_date: z.string(),
  symptoms: z.string().max(700),
  notes: z.string().max(4000),
});
function PeriodForm({
  initial,
  onSaved,
}: {
  initial: Row<'period_records'> | null;
  onSaved: () => void;
}) {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const form = useForm({
    resolver: zodResolver(periodSchema),
    defaultValues: {
      start_date: initial?.start_date || todayISO(timezone),
      end_date: initial?.end_date || '',
      symptoms: initial?.symptoms.join(', ') || '',
      notes: initial?.notes || '',
    },
  });
  const enabled = ws.configured && !!ws.userId;
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await action.run({
          type: 'cycle.record.save',
          id: initial?.id,
          fields: {
            start_date: values.start_date,
            end_date: values.end_date || null,
            symptoms: values.symptoms
              .split(/[,،]/)
              .map((v) => v.trim())
              .filter(Boolean),
            notes: values.notes,
          },
        });
        if (result.ok) onSaved();
      })}
    >
      <div className="notice privacy">
        <LockKeyhole size={17} />
        <p>
          {t(
            'این رکورد، علائم و یادداشت‌ها هرگز با همراهت به اشتراک گذاشته نمی‌شوند.',
            'This record, its symptoms and notes are never shared with your partner.',
          )}
        </p>
      </div>
      <div className="form-grid">
        <Field label={t('روز شروع', 'Start date')}>
          <input
            type="date"
            {...form.register('start_date')}
            max={todayISO(timezone)}
            disabled={!enabled}
          />
        </Field>
        <Field label={t('روز پایان، اگر می‌دانی', 'End date, if you know it')}>
          <input
            type="date"
            {...form.register('end_date')}
            max={todayISO(timezone)}
            disabled={!enabled}
          />
        </Field>
      </div>
      <Field
        label={t('علائم، فقط اگر بخواهی', 'Symptoms, only if you want')}
        hint={t(
          'اختیاری؛ با ویرگول جدا کن. نیازی به ثبت علائم نیست.',
          'Optional; separate with commas. You never have to record symptoms.',
        )}
      >
        <input {...form.register('symptoms')} disabled={!enabled} maxLength={700} />
      </Field>
      <Field label={t('یادداشت شخصی (اختیاری)', 'A private note (optional)')}>
        <textarea {...form.register('notes')} rows={4} maxLength={4000} disabled={!enabled} />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onSaved}>
          {t('انصراف', 'Cancel')}
        </Button>
        <Button type="submit" busy={action.pending} disabled={!enabled}>
          <LockKeyhole size={15} />
          {t('ذخیره، فقط برای من', 'Save, just for me')}
        </Button>
      </div>
    </form>
  );
}
function CycleSettings({ data }: { data: CycleData | undefined }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const toast = useToast();
  const [enabled, setEnabled] = useState(data?.settings?.prediction_enabled || false);
  const [length, setLength] = useState(data?.settings?.cycle_length || 28);
  const [duration, setDuration] = useState(data?.settings?.period_length || 5);
  const [shareStatus, setShareStatus] = useState(data?.sharing?.share_status || false);
  const [shareDate, setShareDate] = useState(data?.sharing?.share_estimate || false);
  const [status, setStatus] = useState(data?.sharing?.status_text || '');
  const [date, setDate] = useState(data?.sharing?.approximate_date || '');
  const canSave = ws.configured && !!ws.userId;
  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-header">
          <h2>{t('تنظیمات شخصی من', 'My personal preferences')}</h2>
          <Flower2 size={20} />
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await action.run({
              type: 'cycle.settings',
              prediction_enabled: enabled,
              cycle_length: length,
              period_length: duration,
            });
            if (result.ok) toast(t('تنظیمات شخصی ذخیره شد.', 'Personal preferences saved.'));
          }}
        >
          <Toggle
            checked={enabled}
            onChange={setEnabled}
            disabled={!canSave}
            label={t('نمایش تخمین دوره‌ی بعد', 'Show an estimated next period')}
            description={t(
              'خاموش به‌صورت پیش‌فرض. حداقل دو شروع ثبت‌شده لازم است.',
              'Off by default. At least two recorded start dates are needed.',
            )}
          />
          <div className="form-grid">
            <Field
              label={t('طول معمول چرخه، به انتخاب تو', 'Your estimated cycle length')}
              hint={t(
                '۱۵ تا ۹۰ روز؛ توصیه‌ی پزشکی نیست.',
                '15–90 days; not a medical recommendation.',
              )}
            >
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                min={15}
                max={90}
                required
                disabled={!canSave}
              />
            </Field>
            <Field
              label={t('مدت معمول دوره', 'Your estimated period duration')}
              hint={t('۱ تا ۱۵ روز، قابل تغییر', '1–15 days; change it at any time')}
            >
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
                max={15}
                required
                disabled={!canSave}
              />
            </Field>
          </div>
          <Button type="submit" busy={action.pending} disabled={!canSave}>
            {t('ذخیره‌ی تنظیمات', 'Save preferences')}
          </Button>
        </form>
        <div className="privacy-explainer">
          <Info size={17} />
          <p>
            {t(
              'با سه رکورد یا بیشتر، میانه‌ی فاصله‌ی حداکثر شش چرخه استفاده می‌شود. با دو رکورد، طول انتخابی خودت مبناست. داده‌ی ناکافی یا فاصله‌های خارج از ۱۵ تا ۹۰ روز، تخمین ایجاد نمی‌کنند.',
              'With three or more records, the median of up to six intervals is used. With two records, your chosen length is used. Insufficient data or intervals outside 15–90 days produce no estimate.',
            )}
          </p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>{t('اشتراک‌گذاری، فقط با انتخاب من', 'Sharing, only on my terms')}</h2>
          <ShieldCheck size={19} />
        </div>
        <p className="panel-subtitle">
          {t(
            'این دو انتخاب مستقل‌اند. هیچ‌کدام سوابق، علائم یا یادداشت‌ها را باز نمی‌کند.',
            'These are independent choices. Neither exposes records, symptoms, or notes.',
          )}
        </p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await action.run({
              type: 'cycle.sharing',
              share_status: shareStatus,
              share_estimate: shareDate,
              status_text: status,
              approximate_date: date || null,
            });
            if (result.ok)
              toast(
                t('انتخاب‌های اشتراک‌گذاری اعمال شد.', 'Your sharing choices have been applied.'),
              );
          }}
        >
          <Toggle
            checked={shareStatus}
            onChange={setShareStatus}
            label={t('اشتراک یک وضعیت ساده', 'Share a simple status')}
            description={t(
              'فقط عبارتی که خودت می‌نویسی، در همین بخش برای همراهت نمایش داده می‌شود.',
              'Only the wording you write is shown to your partner in this section.',
            )}
            disabled={!canSave || !ws.couple}
          />
          {shareStatus && (
            <Field label={t('عبارت خنثی به انتخاب تو', 'Neutral wording you choose')}>
              <input
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                maxLength={80}
                placeholder={t(
                  'مثلاً: کمی مراقبت بیشتر دوست دارم',
                  'For example: A little extra care would be lovely',
                )}
                required
              />
            </Field>
          )}
          <Toggle
            checked={shareDate}
            onChange={setShareDate}
            label={t('اشتراک یک تاریخ تقریبی', 'Share an approximate date')}
            description={t(
              'خودت تاریخ را انتخاب می‌کنی؛ پیش‌بینی‌ها خودکار منتقل نمی‌شوند.',
              'You select the date. Predictions are never shared automatically.',
            )}
            disabled={!canSave || !ws.couple}
          />
          {shareDate && (
            <Field label={t('تاریخ تقریبی انتخاب‌شده', 'The approximate date you choose')}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          )}
          <Button type="submit" busy={action.pending} disabled={!canSave}>
            {t('اعمال انتخاب‌های من', 'Apply my choices')}
          </Button>
          {(data?.sharing?.share_status || data?.sharing?.share_estimate) && (
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await action.run({
                  type: 'cycle.sharing',
                  share_status: false,
                  share_estimate: false,
                  status_text: '',
                  approximate_date: null,
                });
                if (result.ok) {
                  setShareStatus(false);
                  setShareDate(false);
                  setStatus('');
                  setDate('');
                  toast(t('دسترسی جدید همراهت قطع شد.', 'Future partner access has been revoked.'));
                }
              }}
            >
              {t('همین حالا، همه‌ی اشتراک‌ها را لغو کن', 'Revoke all sharing now')}
            </Button>
          )}
        </form>
        <p className="field-hint" style={{ marginTop: 16 }}>
          {t(
            'لغو، دسترسی بعدی را می‌بندد؛ نمی‌تواند اطلاعاتی را که قبلاً دیده یا ذخیره شده از ذهن یا دستگاه دیگری پاک کند.',
            'Revoking stops future access; it cannot erase information someone already saw or saved.',
          )}
        </p>
      </section>
      {!!data?.partner.length && (
        <section className="panel">
          <div className="panel-header">
            <h2>
              {t('چیزی که همراهت انتخاب کرده به اشتراک بگذارد', 'What your partner chose to share')}
            </h2>
            <Heart size={18} />
          </div>
          {data.partner.map((item) => (
            <div key={item.owner_id}>
              <p>{item.status_text}</p>
              {item.approximate_date && (
                <p>
                  {t('تاریخ تقریبی:', 'Approximate date:')} {item.approximate_date}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
function ReminderForm({ onSaved }: { onSaved: () => void }) {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const [kind, setKind] = useState<'log' | 'estimate' | 'supplies'>('log');
  const [date, setDate] = useState(
    utcToLocal(new Date(Date.now() + 86400000).toISOString(), timezone),
  );
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        let due: string;
        try {
          due = localToUtc(date, timezone);
          if (new Date(due) <= new Date()) throw new Error('past');
        } catch {
          setError(
            t(
              'یک زمان آینده و خارج از ساعت مبهم تغییر ساعت تابستانی انتخاب کن.',
              'Choose an unambiguous future time, outside a daylight-saving transition.',
            ),
          );
          return;
        }
        const result = await action.run({
          type: 'cycle.reminder.save',
          kind,
          due_at: due,
          enabled,
          timezone,
        });
        if (result.ok) onSaved();
      }}
    >
      <p className="muted leading">
        {t(
          'هر یادآور نیازمند انتخاب صریح توست. متن پیش‌فرض فقط «یک یادآوری خصوصی» است؛ نوع یادآور و اطلاعات سلامت به صفحه‌ی قفل نمی‌روند.',
          'Each reminder requires your explicit choice. The default text is simply a private update; its type and health details are never placed on your lock screen.',
        )}
      </p>
      <Field label={t('برای خودم یادآوری کن', 'A reminder just for me')}>
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="log">{t('ثبت دوره', 'Log a period')}</option>
          <option value="estimate">{t('پیش از تاریخ تقریبی', 'Before an estimated date')}</option>
          <option value="supplies">
            {t('آماده‌کردن لوازم شخصی', 'Prepare personal supplies')}
          </option>
        </Select>
      </Field>
      <Field label={t('زمان انتخابی من', 'My chosen reminder time')} hint={timezone} error={error}>
        <input
          type="datetime-local"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label={t('این یادآور مشخص را فعال می‌کنم', 'I explicitly enable this reminder')}
        description={t(
          'اعلان‌های خصوصی هم باید در تنظیمات اعلان فعال باشند.',
          'Private reminders must also be enabled in notification preferences.',
        )}
      />
      <Button type="submit" disabled={!ws.configured || !enabled} busy={action.pending}>
        <Bell size={16} />
        {t('ذخیره‌ی یادآور خصوصی', 'Save my private reminder')}
      </Button>
      <Link href="/notifications" className="text-link">
        {t('تنظیم اعلان‌های خصوصی', 'Manage private notifications')}
      </Link>
    </form>
  );
}
export function CycleScreen() {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const query = useData<CycleData>('cycle', {}, false);
  const action = useAction();
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'preferences' | 'reminders'>('overview');
  const [selected, setSelected] = useState(todayISO(timezone));
  const [record, setRecord] = useState<Row<'period_records'> | null>(null);
  const [open, setOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const data = query.data;
  const estimate = estimatePeriod(
    data?.records || [],
    data?.settings?.prediction_enabled || false,
    data?.settings?.cycle_length || 28,
  );
  const periodDays = (data?.records || []).flatMap((r) => {
    const days: string[] = [];
    let day = Temporal.PlainDate.from(r.start_date);
    const end = Temporal.PlainDate.from(r.end_date || r.start_date);
    while (Temporal.PlainDate.compare(day, end) <= 0 && days.length < 31) {
      days.push(day.toString());
      day = day.add({ days: 1 });
    }
    return days;
  });
  return (
    <>
      <PageHeader
        eyebrow="MY WELLBEING · PRIVATE BY DEFAULT"
        title={t('یک گوشه، فقط برای خودم.', 'A little space, just for me.')}
        description={t(
          'بدنت، انتخاب‌هایت، حریم خودت. با ملایمت و بدون قضاوت.',
          'Your body. Your choices. Your own space. Gently, without judgement.',
        )}
        action={
          <Button
            onClick={() => {
              setRecord(null);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            {t('ثبت دوره', 'Log a period')}
          </Button>
        }
      />
      <SetupNotice />
      <div className="notice privacy">
        <LockKeyhole size={19} />
        <p>
          {t(
            'خصوصی به‌صورت پیش‌فرض. همراهت هیچ دسترسی به دوره‌ها، علائم، یادداشت‌ها یا پیش‌بینی‌ها ندارد. این اطلاعات در خانه‌ی مشترک نمایش داده نمی‌شود.',
            'Private by default. Your partner cannot access your records, symptoms, notes, or predictions. None of this appears on your shared dashboard.',
          )}
        </p>
      </div>
      <div className="tab-bar">
        {[
          { id: 'overview', fa: 'تقویم و روزهای من', en: 'My calendar & history' },
          { id: 'preferences', fa: 'انتخاب‌ها و حریم من', en: 'My choices & privacy' },
          { id: 'reminders', fa: 'یادآورهای من', en: 'My reminders' },
        ].map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id as typeof tab)}
          >
            {t(item.fa, item.en)}
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : tab === 'preferences' ? (
        <CycleSettings key={data?.settings?.owner_id || 'unconfigured'} data={data} />
      ) : tab === 'reminders' ? (
        <section className="panel">
          <div className="panel-header">
            <h2>{t('یادآوری‌های آرام و خصوصی', 'Quiet, private reminders')}</h2>
            <Button variant="secondary" onClick={() => setReminderOpen(true)}>
              <Plus size={16} />
              {t('یادآور تازه', 'New reminder')}
            </Button>
          </div>
          {data?.reminders.length ? (
            data.reminders.map((reminder) => (
              <article className="reminder-row" key={reminder.id}>
                <Bell size={18} color="var(--dusty-rose)" />
                <div>
                  <h3>
                    {reminder.kind === 'log'
                      ? t('ثبت دوره', 'Log a period')
                      : reminder.kind === 'estimate'
                        ? t('پیش از تاریخ تقریبی', 'Before an estimate')
                        : t('آماده‌کردن لوازم', 'Prepare supplies')}
                  </h3>
                  <p>
                    {formatDate(reminder.due_at, locale, reminder.timezone)} ·{' '}
                    {formatTime(reminder.due_at, locale, reminder.timezone)}
                  </p>
                </div>
                <Badge>
                  {reminder.enabled
                    ? t('فعال', 'Enabled')
                    : t('خاموش / پردازش‌شده', 'Off / processed')}
                </Badge>
                <Button
                  variant="ghost"
                  aria-label={t('تغییر وضعیت یادآور', 'Toggle reminder')}
                  onClick={() =>
                    void action.run({
                      type: 'cycle.reminder.save',
                      id: reminder.id,
                      kind: reminder.kind as 'log' | 'estimate' | 'supplies',
                      enabled: !reminder.enabled,
                      due_at: reminder.due_at,
                      timezone: reminder.timezone,
                    })
                  }
                >
                  <Bell size={15} />
                </Button>
                <ConfirmButton
                  variant="ghost"
                  title={t('حذف یادآور؟', 'Delete reminder?')}
                  description={t('دیگر پردازش نخواهد شد.', 'It will no longer be processed.')}
                  onConfirm={async () => {
                    await action.run({ type: 'cycle.reminder.delete', id: reminder.id });
                  }}
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </article>
            ))
          ) : (
            <EmptyState
              icon={Bell}
              title={t('هیچ یادآوری خودکار فعال نیست.', 'No reminders are automatically enabled.')}
              description={t(
                'اگر دوست داری، زمان و هدف هر یادآور را خودت انتخاب کن. تحویل اعلان به تنظیمات سرور و دستگاه بستگی دارد.',
                'If you’d like one, choose its purpose and time yourself. Delivery depends on server and device configuration.',
              )}
            />
          )}
          <div className="privacy-explainer">
            <ShieldCheck size={17} />
            <p>
              {t(
                'این نسخه هیچ یادآور سلامت برای همراهت ارسال نمی‌کند. فقط صاحب داده دریافت‌کننده است. یادآورها یک‌باره‌اند و پس از پردازش خاموش می‌شوند.',
                'This version never sends health reminders to your partner. Only the owner can receive them. Reminders are one-time and switch off after processing.',
              )}
            </p>
          </div>
        </section>
      ) : (
        <div className="calendar-layout">
          <div>
            <CalendarGrid selected={selected} onSelect={setSelected} periodDays={periodDays} />
            <div className="cycle-summary" style={{ marginTop: 22 }}>
              <div className="eyebrow" dir="ltr">
                AN ESTIMATE, NEVER A PROMISE
              </div>
              <h2>
                {!data?.settings?.prediction_enabled
                  ? t('پیش‌بینی خاموش است.', 'Predictions are turned off.')
                  : !estimate
                    ? t('هنوز اطلاعات کافی نداریم.', 'There isn’t enough history yet.')
                    : estimate.date < todayISO(timezone)
                      ? t('این تخمین در گذشته است.', 'This estimate is in the past.')
                      : t(
                          `حدود ${formatDate(estimate.date, locale, 'UTC')}`,
                          `Around ${formatDate(estimate.date, locale, 'UTC')}`,
                        )}
              </h2>
              <p>
                {estimate?.date && estimate.date < todayISO(timezone)
                  ? t(
                      'تاریخ تازه یا علت پزشکی حدس نمی‌زنیم. هر وقت خواستی، سابقه‌ات را اصلاح کن.',
                      'We won’t invent a new date or infer a medical cause. Update your records whenever you choose.',
                    )
                  : estimate
                    ? t(
                        'این یک تخمین است؛ چرخه و زمان شروع می‌تواند تغییر کند.',
                        'This is only an estimate; cycle length and timing can vary.',
                      )
                    : t(
                        'اگر بخواهی، در بخش انتخاب‌ها فعالش کن. حداقل دو شروع ثبت‌شده لازم است.',
                        'You can enable it in My choices. At least two recorded starts are needed.',
                      )}
              </p>
              {estimate?.irregular && (
                <p style={{ marginTop: 10 }}>
                  {t(
                    'فاصله‌ی رکوردها متغیر است؛ این تخمین عدم قطعیت بیشتری دارد.',
                    'Your recorded intervals vary; this estimate has greater uncertainty.',
                  )}
                </p>
              )}
            </div>
            <div className="privacy-explainer">
              <Info size={17} />
              <p>
                {t(
                  'این ابزار تشخیص پزشکی، روش جلوگیری از بارداری یا تعیین روزهای باروری نیست. از نبود یک رکورد، بارداری، فعالیت جنسی یا وضعیت رابطه نتیجه‌گیری نمی‌کند.',
                  'This is not a diagnostic tool, contraception, or a fertility calendar. Missing records never imply pregnancy, sexual activity, or relationship status.',
                )}
              </p>
            </div>
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>{t('تاریخچه‌ی شخصی من', 'My private history')}</h2>
              <LockKeyhole size={18} />
            </div>
            {data?.records.length ? (
              data.records.map((item) => (
                <article className="cycle-record" key={item.id}>
                  <div>
                    <h3>
                      {formatDate(item.start_date, locale, 'UTC')}
                      {item.end_date
                        ? ` — ${formatDate(item.end_date, locale, 'UTC', { year: undefined })}`
                        : ''}
                    </h3>
                    {!item.end_date && (
                      <p>{t('پایان هنوز ثبت نشده', 'End date not recorded yet')}</p>
                    )}
                    {item.symptoms.length > 0 && <p>{item.symptoms.join(t('، ', ', '))}</p>}
                    {item.notes && <p>{item.notes}</p>}
                  </div>
                  <div className="record-actions">
                    <Button
                      variant="ghost"
                      aria-label={t('ویرایش رکورد', 'Edit record')}
                      onClick={() => {
                        setRecord(item);
                        setOpen(true);
                      }}
                    >
                      <PenLine size={14} />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      title={t('حذف این رکورد؟', 'Delete this record?')}
                      description={t(
                        'تاریخ‌ها، علائم و یادداشت این رکورد حذف می‌شود.',
                        'This record’s dates, symptoms and note will be removed.',
                      )}
                      onConfirm={async () => {
                        await action.run({ type: 'cycle.record.delete', id: item.id });
                      }}
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                compact
                icon={Flower2}
                title={t('با ریتم خودت شروع کن.', 'Begin at your own pace.')}
                description={t(
                  'فقط چیزهایی را ثبت کن که برای خودت مفیدند. هیچ ورودی‌ای اجباری نیست.',
                  'Record only what feels useful to you. Nothing here is obligatory.',
                )}
              />
            )}
            <div className="form-actions spread">
              <ExportButton scope="cycle" disabled={!ws.configured} className="button secondary">
                <Download size={15} />
                {t('خروجی شخصی', 'Private export')}
              </ExportButton>
            </div>
          </section>
        </div>
      )}
      <section className="panel danger-panel" style={{ marginTop: 28 }}>
        <h2>{t('پاک‌کردن کامل این بخش', 'Erase this space completely')}</h2>
        <p>
          {t(
            'همه‌ی سوابق، علائم، یادداشت‌ها، یادآورها و اعلان‌های سلامت خودت حذف و اشتراک‌گذاری و پیش‌بینی خاموش می‌شوند. سایر بخش‌های برنامه تغییر نمی‌کنند. نسخه‌های پشتیبان تابع دوره‌ی نگه‌داری میزبان‌اند.',
            'All of your records, symptoms, notes, reminders, and health notifications are removed; sharing and predictions are disabled. Other app features are unaffected. Backups follow the operator’s retention policy.',
          )}
        </p>
        <ConfirmButton
          disabled={!ws.configured || action.pending}
          title={t('همه‌ی داده‌های چرخه‌ی من حذف شود؟', 'Permanently delete all my cycle data?')}
          description={t(
            'این کار از داخل برنامه قابل بازگشت نیست. قبل از حذف می‌توانی خروجی بگیری.',
            'This cannot be undone in the app. You can export your data first.',
          )}
          onConfirm={async () => {
            const result = await action.run({ type: 'cycle.delete' });
            if (result.ok) {
              toast(
                t(
                  'داده‌های چرخه حذف و اشتراک‌گذاری خاموش شد.',
                  'Your cycle data was deleted and sharing disabled.',
                ),
              );
              setTab('overview');
            }
          }}
        >
          <Trash2 size={15} />
          {t('حذف دائمی داده‌های چرخه‌ی من', 'Permanently delete my cycle data')}
        </ConfirmButton>
      </section>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          record
            ? t('اصلاح رکورد من', 'Correct my record')
            : t('یک ثبت، فقط برای خودم', 'A record, just for me')
        }
      >
        <PeriodForm initial={record} onSaved={() => setOpen(false)} />
      </Modal>
      <Modal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title={t('یک یادآوری خصوصی', 'A quiet private reminder')}
      >
        <ReminderForm onSaved={() => setReminderOpen(false)} />
      </Modal>
    </>
  );
}
