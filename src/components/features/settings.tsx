'use client';
import { ExportButton } from '@/components/ui/data-export';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  UserRound,
  Heart,
  LockKeyhole,
  Download,
  LogOut,
  Trash2,
  ShieldCheck,
  Bell,
  ChevronRight,
  MapPin,
  KeyRound,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  Button,
  Field,
  Select,
  ErrorState,
  Modal,
  ConfirmButton,
  Badge,
  LinkButton,
} from '@/components/ui/primitives';
import { InvitationCreator } from './onboarding';
import { useAction, useData } from '@/hooks/use-data';
import { timezoneSchema } from '@/schemas/actions';
import { deviceId, errorText, requestJSON, broadcastSessionChange } from '@/lib/client-api';
import { revokeThisDevice } from '@/lib/notification-client';
import { formatDate, todayISO } from '@/lib/dates';
interface SettingsData {
  invitations: {
    id: string;
    expires_at: string;
    revoked_at: string | null;
    accepted_at: string | null;
  }[];
  email?: string;
  canDeleteAccount: boolean;
}
const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  locale: z.enum(['fa', 'en']),
  timezone: timezoneSchema,
});
export function SettingsScreen() {
  const { t, locale, setLocale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const cache = useQueryClient();
  const action = useAction();
  const query = useData<SettingsData>('settings', {}, false);
  const [date, setDate] = useState(ws.couple?.relationship_start || '');
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: ws.profile?.display_name || '',
      locale: ws.profile?.locale === 'en' ? ('en' as const) : ('fa' as const),
      timezone: ws.profile?.timezone || 'UTC',
    },
  });
  async function signout(everywhere = false) {
    setBusy(true);
    try {
      await requestJSON('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ type: 'signout', everywhere, device_id: deviceId() }),
      });
      await revokeThisDevice().catch(() => {});
      broadcastSessionChange();
      cache.clear();
      window.location.replace('/login');
    } catch (error) {
      toast(errorText(error, t), 'error');
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MAKE THIS SPACE YOURS"
        title={t('به شیوه‌ی خودمان.', 'A little more like us.')}
        description={t(
          'حساب، انتخاب‌ها و مرزهایی که خودت تعیین می‌کنی.',
          'Your account, your preferences, and boundaries you choose.',
        )}
      />
      <SetupNotice />
      {query.isError && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      <div className="settings-grid">
        <div className="stack">
          <section className="panel">
            <div className="settings-profile">
              <span className="avatar">
                {ws.profile?.display_name.slice(0, 1) || <UserRound size={24} />}
              </span>
              <div>
                <h2>{ws.profile?.display_name || t('حساب من', 'My account')}</h2>
                <p dir="ltr">{query.data?.email || t('هنوز وارد نشده‌اید', 'Not signed in')}</p>
              </div>
            </div>
            <LinkButton
              href="/onboarding?next=/settings"
              variant="secondary"
              className="full-width profile-preferences-link"
            >
              <UserRound size={17} />
              {t('جنسیت، ظاهر و پیگیری خصوصی', 'Gender, layout and private tracking')}
            </LinkButton>
            <LinkButton href="/cycle" variant="ghost" className="full-width">
              {t('مدیریت یا حذف داده‌های خصوصی چرخه', 'Manage or delete private cycle data')}
            </LinkButton>
            <form
              className="form-stack"
              onSubmit={form.handleSubmit(async (values) => {
                const result = await action.run({ type: 'profile.save', ...values });
                if (result.ok) {
                  setLocale(values.locale);
                  toast(t('تنظیمات حساب ذخیره شد.', 'Profile preferences saved.'));
                }
              })}
            >
              <Field
                label={t('نامی که همراهت می‌بیند', 'The name your partner sees')}
                error={
                  form.formState.errors.display_name
                    ? t('یک نام تا ۶۰ کاراکتر وارد کن.', 'Enter a name up to 60 characters.')
                    : undefined
                }
              >
                <input
                  {...form.register('display_name')}
                  maxLength={60}
                  disabled={!ws.configured}
                />
              </Field>
              <div className="form-grid">
                <Field label={t('زبان و تقویم نمایش', 'Language and display calendar')}>
                  <Select {...form.register('locale')} disabled={!ws.configured}>
                    <option value="fa">فارسی · تقویم خورشیدی</option>
                    <option value="en">English · Gregorian</option>
                  </Select>
                </Field>
                <Field
                  label={t('منطقه‌ی زمانی من', 'My timezone')}
                  error={
                    form.formState.errors.timezone
                      ? t('منطقه‌ی زمانی معتبر وارد کن.', 'Use a valid IANA timezone.')
                      : undefined
                  }
                >
                  <input
                    {...form.register('timezone')}
                    dir="ltr"
                    disabled={!ws.configured}
                    list="profile-zones"
                  />
                  <datalist id="profile-zones">
                    {[
                      'Asia/Tehran',
                      'Europe/London',
                      'Europe/Berlin',
                      'America/New_York',
                      'America/Los_Angeles',
                      'Asia/Dubai',
                      'UTC',
                    ].map((zone) => (
                      <option key={zone} value={zone} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Button
                variant="ghost"
                type="button"
                disabled={!ws.configured}
                onClick={() =>
                  form.setValue('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone, {
                    shouldValidate: true,
                  })
                }
              >
                <MapPin size={14} />
                {t('استفاده از منطقه‌ی زمانی دستگاه', 'Use my device’s timezone')}
              </Button>
              <p className="field-hint">
                {t(
                  'زمان‌ها در UTC ذخیره می‌شوند. تغییر منطقه‌ی نمایش، زمان واقعی رویدادهای قبلی را تغییر نمی‌دهد.',
                  'Timestamps are stored in UTC. Changing your display timezone does not move existing events in time.',
                )}
              </p>
              <Button type="submit" busy={action.pending} disabled={!ws.configured}>
                {t('ذخیره‌ی حساب من', 'Save my profile')}
              </Button>
            </form>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>{t('قصه‌ی دونفره‌ی ما', 'Our story, together')}</h2>
              <Heart size={19} />
            </div>
            {ws.couple ? (
              <>
                <div className="avatar-group" style={{ marginBottom: 20 }}>
                  {ws.members.map((member) => (
                    <span
                      className={`avatar ${member.id !== ws.userId ? 'partner' : ''}`}
                      key={member.id}
                      title={member.display_name}
                    >
                      {member.display_name.slice(0, 1) || <UserRound size={17} />}
                    </span>
                  ))}
                </div>
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const result = await action.run({
                      type: 'couple.update',
                      relationship_start: date || null,
                    });
                    if (result.ok)
                      toast(t('روز شروع ما ذخیره شد.', 'Your beginning has been saved.'));
                  }}
                >
                  <Field
                    label={t('روزی که «ما» شدیم', 'The day we became us')}
                    hint={t(
                      'اختیاری؛ برای نمایش شمارنده‌ی روزها.',
                      'Optional; used for your days-together counter.',
                    )}
                  >
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      max={todayISO(timezone)}
                    />
                  </Field>
                  <Button type="submit" variant="secondary" busy={action.pending}>
                    {t('ذخیره‌ی روز شروع', 'Save our beginning')}
                  </Button>
                </form>
                {ws.members.length < 2 && (
                  <div style={{ marginTop: 25 }}>
                    <InvitationCreator />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="panel-subtitle" style={{ marginTop: 0 }}>
                  {t(
                    'با کد همراهت متصل شو یا یک فضای دونفره بساز.',
                    'Join using your partner’s code, or create a two-person space.',
                  )}
                </p>
                <LinkButton href="/pairing" variant="secondary">
                  {t('اتصال با کد', 'Pair with a code')}
                </LinkButton>
              </>
            )}
            {!!query.data?.invitations.length && (
              <div style={{ marginTop: 22 }}>
                <h3 style={{ fontSize: 12 }}>{t('دعوت‌های من', 'My invitations')}</h3>
                {query.data.invitations.map((invitation) => (
                  <div className="invitation-row" key={invitation.id}>
                    <div>
                      <p>
                        {t('اعتبار تا', 'Expires')}{' '}
                        {formatDate(invitation.expires_at, locale, timezone)}
                      </p>
                      <Badge>
                        {invitation.accepted_at
                          ? t('پذیرفته‌شده', 'Accepted')
                          : invitation.revoked_at
                            ? t('لغوشده', 'Revoked')
                            : new Date(invitation.expires_at) < new Date()
                              ? t('منقضی‌شده', 'Expired')
                              : t('در انتظار', 'Waiting')}
                      </Badge>
                    </div>
                    {!invitation.accepted_at &&
                      !invitation.revoked_at &&
                      new Date(invitation.expires_at) > new Date() && (
                        <ConfirmButton
                          variant="ghost"
                          title={t('لغو این دعوت؟', 'Revoke this invitation?')}
                          description={t(
                            'این پیوند دیگر قابل استفاده نخواهد بود.',
                            'This link will no longer be usable.',
                          )}
                          onConfirm={async () => {
                            await action.run({ type: 'invitation.revoke', id: invitation.id });
                          }}
                        >
                          <Trash2 size={14} />
                        </ConfirmButton>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>{t('حریم و امنیت من', 'My privacy & security')}</h2>
              <ShieldCheck size={20} />
            </div>
            <Link href="/privacy" className="settings-link">
              <span>
                <LockKeyhole size={16} />
                {t('چه چیزی خصوصی می‌ماند؟', 'What stays private?')}
              </span>
              <ChevronRight size={15} />
            </Link>
            <Link href="/notifications" className="settings-link">
              <span>
                <Bell size={16} />
                {t('اعلان‌ها و دستگاه‌های من', 'Notifications & my devices')}
              </span>
              <ChevronRight size={15} />
            </Link>
            <Link href="/cycle" className="settings-link">
              <span>
                <Heart size={16} />
                {t('داده‌های سلامت و خروجی خصوصی', 'Health data & private export')}
              </span>
              <ChevronRight size={15} />
            </Link>
            <Link href="/reset-password" className="settings-link">
              <span>
                <KeyRound size={16} />
                {t('دریافت پیوند تغییر رمز', 'Request a password reset link')}
              </span>
              <ChevronRight size={15} />
            </Link>
            <ExportButton scope="account" disabled={!ws.configured} className="settings-link">
              <span>
                <Download size={16} />
                {t('خروجی داده‌های حساب و فضای مجاز', 'Export account & authorized shared data')}
              </span>
              <ChevronRight size={15} />
            </ExportButton>
            <p className="field-hint" style={{ marginTop: 13 }}>
              {t(
                'خروجی حساب شامل سوابق چرخه یا توکن دستگاه نیست. برای سلامت، خروجی جداگانه در همان بخش است. فایل‌های رسانه در خروجی JSON جاسازی نمی‌شوند.',
                'Account export excludes cycle history and device tokens. Health data has a separate export. Media files are not embedded in the JSON export.',
              )}
            </p>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>{t('نشست‌های من', 'My sessions')}</h2>
              <LogOut size={18} />
            </div>
            <p className="panel-subtitle">
              {t(
                'با خروج، داده‌ی موقت صفحه پاک و اشتراک دستگاه لغو می‌شود. لغو نشست‌های دیگر ممکن است تا انقضای توکن دسترسی زمان ببرد.',
                'Signing out clears this page’s cache and revokes device subscriptions. Other access tokens may remain valid until they expire.',
              )}
            </p>
            <div className="stack" style={{ gap: 12 }}>
              <Button
                variant="secondary"
                busy={busy}
                disabled={!ws.configured}
                onClick={() => void signout()}
              >
                <LogOut size={16} />
                {t('خروج از این دستگاه', 'Sign out on this device')}
              </Button>
              <ConfirmButton
                variant="ghost"
                disabled={!ws.configured || busy}
                title={t('خروج از همه‌ی دستگاه‌ها؟', 'Sign out everywhere?')}
                description={t(
                  'نشست‌های تازه‌سازی و همه‌ی اشتراک‌های پوش لغو می‌شوند. توکن‌های دسترسی تا زمان انقضای کوتاه خود معتبر می‌مانند.',
                  'Refresh sessions and all push subscriptions will be revoked. Existing access tokens remain valid until their short expiry.',
                )}
                onConfirm={() => signout(true)}
              >
                {t('خروج از همه‌ی دستگاه‌ها', 'Sign out on all devices')}
              </ConfirmButton>
            </div>
          </section>
          <section className="panel danger-panel">
            <h2>{t('حذف حساب من', 'Delete my account')}</h2>
            <p>
              {t(
                'پروفایل و محتوای متعلق به تو، از جمله خاطره‌ها و پیام‌هایت، حذف می‌شوند. نامه‌های خطاب به تو هم حذف می‌شوند؛ سایر محتوای همراهت باقی می‌ماند. پاک‌سازی فایل‌ها به‌صورت قابل‌تلاش‌مجدد صف می‌شود. این کار نیازمند تأیید رمز و کلید امن سرور است.',
                'Your profile and owned content, including your memories and messages, will be removed. Letters addressed to you are also removed; your partner’s other content remains. File erasure is durably queued for retry. Deletion requires password confirmation and the server-only admin key.',
              )}
            </p>
            <Button
              variant="danger"
              onClick={() => setDeleting(true)}
              disabled={!query.data?.canDeleteAccount}
            >
              <Trash2 size={15} />
              {t('درخواست حذف حساب', 'Delete my account')}
            </Button>
            {!query.data?.canDeleteAccount && (
              <p className="field-hint" style={{ marginTop: 13 }}>
                {t(
                  'در انتظار پیکربندی امن حذف حساب در سرور.',
                  'Awaiting secure account-deletion configuration on the server.',
                )}
              </p>
            )}
          </section>
        </div>
      </div>
      <Modal
        open={deleting}
        onClose={() => !busy && setDeleting(false)}
        title={t('این تصمیم، دائمی‌ست.', 'This is a permanent goodbye.')}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await requestJSON('/api/account', {
                method: 'DELETE',
                body: JSON.stringify({ password, confirmation }),
              });
              await revokeThisDevice().catch(() => {});
              broadcastSessionChange();
              cache.clear();
              window.location.replace('/login');
            } catch (error) {
              toast(errorText(error, t), 'error');
              setBusy(false);
            }
          }}
        >
          <p className="muted leading">
            {t(
              'برای تأیید، رمز فعلی و عبارت DELETE را وارد کن. بهتر است ابتدا خروجی بگیری. نسخه‌های پشتیبان طبق سیاست نگه‌داری میزبان منقضی می‌شوند.',
              'Confirm with your current password and the word DELETE. Consider exporting first. Backups expire according to the operator’s retention policy.',
            )}
          </p>
          <Field label={t('رمز فعلی', 'Current password')}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </Field>
          <Field label={t('برای تأیید بنویس: DELETE', 'Type DELETE to confirm')}>
            <input
              dir="ltr"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              pattern="DELETE"
              autoComplete="off"
            />
          </Field>
          <Button
            type="submit"
            variant="danger"
            busy={busy}
            disabled={confirmation !== 'DELETE' || !password}
          >
            <Trash2 size={16} />
            {t('حذف دائمی حساب و محتوای من', 'Permanently delete my account and content')}
          </Button>
        </form>
      </Modal>
    </>
  );
}
