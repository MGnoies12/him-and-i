'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette,
  ShieldCheck,
  Flower2,
  MessageCircle,
  Images,
  ArrowLeft,
  MapPin,
} from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  Field,
  Select,
  Toggle,
  Button,
  LinkButton,
} from '@/components/ui/primitives';
import { useAction } from '@/hooks/use-data';
import { profileSetupFields, timezoneSchema } from '@/schemas/actions';
import { personalTheme, type Gender, type Layout } from '@/lib/personalization';
import { safeRedirect } from '@/lib/config';
import { formatDate, todayISO } from '@/lib/dates';

export function PersonalizationScreen({ next = '/home' }: { next?: string }) {
  const { t, locale, timezone: currentTimezone } = useI18n();
  const ws = useWorkspace();
  const router = useRouter();
  const action = useAction();
  const [name, setName] = useState(ws.profile?.display_name || '');
  const [gender, setGender] = useState<Gender>(
    (ws.personalization?.gender as Gender) || 'unspecified',
  );
  const [layout, setLayout] = useState<Layout>((ws.personalization?.layout as Layout) || 'auto');
  const [timezone, setTimezone] = useState(ws.profile?.timezone || currentTimezone);
  const [tracking, setTracking] = useState(ws.personalization?.cycle_tracking || false);
  const [start, setStart] = useState('');
  const [length, setLength] = useState('');
  const [irregular, setIrregular] = useState(false);
  const [error, setError] = useState('');
  const enabled = ws.configured && !!ws.userId;
  const theme = personalTheme(gender, layout);
  const destination = safeRedirect(next).startsWith('/onboarding') ? '/home' : safeRedirect(next);
  return (
    <div className="personalization-page" data-personal-theme={theme}>
      <PageHeader
        eyebrow="YOUR SPACE, YOUR WAY"
        title={t('اول، کمی از خودت.', 'First, a little about you.')}
        description={t(
          'یک حساب مستقل، یک ظاهر به سلیقهٔ تو؛ و بعد، اتصال به همراهت.',
          'Your own account, a layout that feels like you, then a connection with your person.',
        )}
      />
      <SetupNotice />
      <ol className="setup-steps" aria-label={t('مراحل شروع', 'Getting started steps')}>
        <li>{t('۱ · حساب مستقل', '1 · Your account')}</li>
        <li aria-current="step">{t('۲ · انتخاب‌های من', '2 · My preferences')}</li>
        <li>{t('۳ · کد اتصال', '3 · Pairing code')}</li>
      </ol>
      <div className="personalization-grid">
        <form
          className="panel form-stack"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            const parsed = profileSetupFields.safeParse({
              display_name: name,
              gender,
              layout,
              locale,
              timezone,
              cycle_tracking: tracking,
              period_start: tracking && start ? start : null,
              reported_length: tracking && start && length && !irregular ? Number(length) : null,
              irregular: tracking && irregular,
            });
            if (!parsed.success) {
              setError(
                t(
                  'نام و منطقهٔ زمانی معتبر وارد کن. برای برآورد با یک تاریخ، طول معمول چرخه بین ۱۵ تا ۹۰ روز لازم است.',
                  'Enter a name and valid timezone. An estimate from one date needs your usual cycle length, between 15 and 90 days.',
                ),
              );
              return;
            }
            const result = await action.run({ type: 'profile.complete', fields: parsed.data });
            if (result.ok) {
              router.replace(destination);
              router.refresh();
            }
          }}
        >
          <div className="panel-header">
            <h2>{t('حساب شخصی من', 'My personal profile')}</h2>
            <Palette size={20} />
          </div>
          <Field label={t('نام شما', 'Your name')}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoComplete="given-name"
              disabled={!enabled}
            />
          </Field>
          <div className="form-grid">
            <Field label={t('جنسیت (اختیاری)', 'Gender (optional)')}>
              <Select value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
                <option value="unspecified">{t('ترجیح می‌دهم نگویم', 'Prefer not to say')}</option>
                <option value="female">{t('زن / دختر', 'Woman / girl')}</option>
                <option value="male">{t('مرد / پسر', 'Man / boy')}</option>
                <option value="other">{t('دیگر', 'Another identity')}</option>
              </Select>
            </Field>
            <Field label={t('ظاهر و چیدمان', 'Appearance and layout')}>
              <Select value={layout} onChange={(event) => setLayout(event.target.value as Layout)}>
                <option value="auto">
                  {t('پیشنهاد بر اساس انتخاب من', 'Suggest from my choice')}
                </option>
                <option value="rose">
                  {t('رز · خاطره‌ها در اولویت', 'Rose · memories first')}
                </option>
                <option value="dusk">
                  {t('آبی آرام · گفت‌وگو در اولویت', 'Dusk · conversation first')}
                </option>
              </Select>
            </Field>
          </div>
          <p className="field-hint">
            {t(
              'پیش‌فرض زن/دختر رز است و مرد/پسر آبی آرام؛ هر ظاهر برای هر حساب قابل انتخاب است. جنسیت هیچ دسترسی اضافه‌ای ایجاد نمی‌کند.',
              'Women/girls default to Rose and men/boys to Dusk; anyone can choose either. Gender never grants access to another person’s data.',
            )}
          </p>
          <Field
            label={t('منطقهٔ زمانی من', 'My timezone')}
            hint={t(
              'تاریخ‌ها و زمان‌های حساب بر اساس این انتخاب نمایش داده می‌شوند.',
              'Your dates and times use this timezone.',
            )}
          >
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              dir="ltr"
              disabled={!enabled}
              maxLength={60}
            />
          </Field>
          <Button
            type="button"
            variant="ghost"
            disabled={!enabled}
            onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
          >
            <MapPin size={15} />
            {t('استفاده از منطقهٔ زمانی دستگاه', 'Use device timezone')}
          </Button>
          <div className="profile-private-section">
            <div className="section-heading">
              <h3>
                <Flower2 size={17} />
                {t('فقط برای خودم', 'Just for me')}
              </h3>
              <ShieldCheck size={18} />
            </div>
            <Toggle
              checked={tracking}
              disabled={!enabled}
              onChange={(value) => {
                setTracking(value);
                if (!value) {
                  setStart('');
                  setLength('');
                  setIrregular(false);
                }
              }}
              label={t('می‌خواهم چرخه‌ام را خصوصی پیگیری کنم', 'I want private cycle tracking')}
              description={t(
                'اختیاری برای همهٔ حساب‌ها؛ هیچ تاریخ یا یادداشتی با همراهت به اشتراک گذاشته نمی‌شود.',
                'Optional for every account. No period date or note is shared with your partner.',
              )}
            />
            {tracking && (
              <div className="form-stack cycle-onboarding-fields">
                <Field
                  label={t(
                    'اولین روز آخرین پریود (اختیاری)',
                    'First day of your last period (optional)',
                  )}
                  hint={t(
                    'ورود با تقویم دستگاه؛ می‌توانی الان رد کنی و بعداً ثبت کنی.',
                    'Use your device’s date input. You can skip this and add it later.',
                  )}
                >
                  <input
                    type="date"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                    max={todayISO(
                      timezoneSchema.safeParse(timezone).success ? timezone : currentTimezone,
                    )}
                    disabled={!enabled}
                  />
                </Field>
                {/^\d{4}-\d{2}-\d{2}$/.test(start) && (
                  <p className="field-hint">{formatDate(start, locale, 'UTC')}</p>
                )}
                <Toggle
                  checked={irregular}
                  onChange={setIrregular}
                  disabled={!enabled || !start}
                  label={t(
                    'چرخه‌ام نامنظم است؛ تاریخ بعدی را برآورد نکن',
                    'My cycles are irregular; do not estimate a next date',
                  )}
                  description={t(
                    'در این حالت تاریخ بعدی حدس زده نمی‌شود.',
                    'No next-period date is guessed in this case.',
                  )}
                />
                {!irregular && (
                  <Field
                    label={t(
                      'طول معمول چرخهٔ من، به روز (اختیاری)',
                      'My usual cycle length, in days (optional)',
                    )}
                    hint={t(
                      'فاصلهٔ شروع دو پریود؛ اگر نمی‌دانی، خالی بگذار تا فقط تاریخ ثبت شود، بدون برآورد.',
                      'Days between the starts of two periods. If unknown, leave blank to save the date without an estimate.',
                    )}
                  >
                    <input
                      type="number"
                      value={length}
                      onChange={(event) => setLength(event.target.value)}
                      min={15}
                      max={90}
                      inputMode="numeric"
                      disabled={!enabled || !start}
                    />
                  </Field>
                )}
                <p className="inline-note">
                  {t(
                    'با ثبت تاریخ و طول چرخه، یک برآورد تقریبی خصوصی فعال می‌شود. این برآورد تشخیص پزشکی، پیش‌بینی بارداری یا روش پیشگیری نیست.',
                    'Saving a date and your cycle length enables a private approximate estimate. It is not medical diagnosis, a pregnancy prediction or contraception.',
                  )}
                </p>
              </div>
            )}
            {!tracking && ws.personalization?.cycle_tracking && (
              <p className="field-hint">
                {t(
                  'خاموش‌کردن، اشتراک‌گذاری و یادآورها را لغو می‌کند؛ سوابق خصوصی تا حذف صریح خودت باقی می‌مانند.',
                  'Turning this off revokes sharing and reminders. Private records remain until you explicitly delete them.',
                )}
              </p>
            )}
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" busy={action.pending} disabled={!enabled} className="full-width">
            {t('ذخیره و ادامه', 'Save and continue')}
            <ArrowLeft size={17} />
          </Button>
        </form>
        <aside
          className="profile-layout-preview panel"
          aria-label={t('پیش‌نمایش چیدمان', 'Layout preview')}
        >
          <span className="eyebrow">
            {t('پیش‌نمایش ظاهر؛ نه اطلاعات واقعی', 'LAYOUT PREVIEW · NO PERSONAL DATA')}
          </span>
          <div className="layout-preview-mark" dir="ltr">
            HIM <i>&</i> I
          </div>
          <h2>
            {theme === 'dusk'
              ? t('آرام، نزدیک، دونفره.', 'Calm, close, together.')
              : t('لطیف، گرم، پر از قصه.', 'Warm, gentle, full of stories.')}
          </h2>
          <p>
            {t(
              'رنگ و ترتیب بخش‌ها برای حساب خودت تغییر می‌کند. همهٔ امکانات مشترک برای هر دو نفر باقی می‌ماند.',
              'The colors and section order change for your account. Both people keep the same shared features.',
            )}
          </p>
          <div className="layout-preview-tiles">
            {(theme === 'dusk' ? ['chat', 'memories'] : ['memories', 'chat']).map((item) => (
              <div key={item}>
                {item === 'chat' ? <MessageCircle size={25} /> : <Images size={25} />}
                <span>
                  {item === 'chat'
                    ? t('گفت‌وگوی ما', 'Our conversation')
                    : t('خاطره‌های ما', 'Our memories')}
                </span>
              </div>
            ))}
          </div>
          <div className="privacy-explainer">
            <ShieldCheck size={20} />
            <p>
              {t(
                'این انتخاب‌ها خصوصی‌اند. برای اتصال، فقط کد یک‌بارمصرف را می‌فرستی، نه مشخصات یا تاریخ‌های شخصی را.',
                'These choices are private. Pairing shares a single-use code, not your personal details or dates.',
              )}
            </p>
          </div>
          <LinkButton href="/privacy" variant="ghost">
            {t('دربارهٔ حریم خصوصی', 'About privacy')}
          </LinkButton>
        </aside>
      </div>
    </div>
  );
}
