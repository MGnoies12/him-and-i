'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Mail,
  MessageCircle,
  CalendarDays,
  Camera,
  LockKeyhole,
  Smartphone,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Toggle,
  ConfirmButton,
} from '@/components/ui/primitives';
import { useAction, useData, useRealtime } from '@/hooks/use-data';
import { registerThisDevice, revokeThisDevice } from '@/lib/notification-client';
import { errorText } from '@/lib/client-api';
import { formatDate, formatTime } from '@/lib/dates';
import type { Row } from '@/types/database';
interface NotificationData {
  items: Row<'notifications'>[];
  preferences: Row<'notification_preferences'>;
  devices: Pick<
    Row<'notification_subscriptions'>,
    'id' | 'device_id' | 'transport' | 'created_at'
  >[];
}
const kinds = {
  message: {
    icon: MessageCircle,
    fa: 'یک پیام تازه منتظر توست.',
    en: 'A little message is waiting for you.',
  },
  letter: { icon: Mail, fa: 'یک نامه آماده‌ی بازشدن است.', en: 'A letter is ready to be opened.' },
  event: {
    icon: CalendarDays,
    fa: 'یکی از برنامه‌های ما نزدیک است.',
    en: 'One of our plans is coming up.',
  },
  memory: {
    icon: Camera,
    fa: 'یک لحظه‌ی تازه در آلبوم ما.',
    en: 'A new moment in our memory book.',
  },
  private_reminder: {
    icon: LockKeyhole,
    fa: 'یک یادآوری خصوصی برای تو.',
    en: 'A private reminder for you.',
  },
};
function Preferences({ data }: { data: NotificationData | undefined }) {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const action = useAction();
  const [prefs, setPrefs] = useState({
    chat: data?.preferences.chat ?? true,
    letters: data?.preferences.letters ?? true,
    events: data?.preferences.events ?? true,
    memories: data?.preferences.memories ?? false,
    cycle: data?.preferences.cycle ?? false,
    push_enabled: data?.preferences.push_enabled ?? false,
  });
  const [explain, setExplain] = useState(false);
  const [registering, setRegistering] = useState(false);
  const categories = [
    {
      id: 'chat',
      fa: 'پیام‌های تازه',
      en: 'New messages',
      descFa: 'فقط یک خبر کوچک، بدون متن پیام.',
      descEn: 'A quiet update, without message text.',
    },
    {
      id: 'letters',
      fa: 'نامه‌های آماده‌ی بازشدن',
      en: 'Letters ready to open',
      descFa: 'وقتی زمان انتشار نامه برسد.',
      descEn: 'When a letter reaches its release time.',
    },
    {
      id: 'events',
      fa: 'قرارها و روزهای خاص',
      en: 'Dates and special days',
      descFa: 'فقط برای برنامه‌هایی که یادآور دارند.',
      descEn: 'Only for events with reminders enabled.',
    },
    {
      id: 'memories',
      fa: 'خاطره‌های تازه',
      en: 'New memories',
      descFa: 'اختیاری؛ هر لحظه قابل خاموش‌کردن.',
      descEn: 'Optional; turn off at any time.',
    },
    {
      id: 'cycle',
      fa: 'یادآورهای شخصی و خصوصی',
      en: 'My discreet private reminders',
      descFa: 'خاموش به‌صورت پیش‌فرض؛ بدون جزئیات سلامت.',
      descEn: 'Off by default; no health details.',
    },
  ] as const;
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <h2>{t('چه خبرهایی به من برسد؟', 'What would you like to hear about?')}</h2>
          <Bell size={19} />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await action.run({
              type: 'notifications.preferences',
              preferences: prefs,
            });
            if (result.ok) {
              if (!prefs.push_enabled) await revokeThisDevice().catch(() => {});
              toast(t('انتخاب‌های اعلان ذخیره شدند.', 'Notification preferences saved.'));
            }
          }}
        >
          {categories.map((item) => (
            <Toggle
              key={item.id}
              checked={prefs[item.id]}
              onChange={(value) => setPrefs((p) => ({ ...p, [item.id]: value }))}
              disabled={!ws.configured}
              label={t(item.fa, item.en)}
              description={t(item.descFa, item.descEn)}
            />
          ))}
          <div className="nav-divider" />
          <Toggle
            checked={prefs.push_enabled}
            onChange={(value) => setPrefs((p) => ({ ...p, push_enabled: value }))}
            label={t('ارسال پوش به دستگاه‌های ثبت‌شده', 'Push to my registered devices')}
            description={t(
              'خاموش‌کردن و ذخیره، اشتراک همه‌ی دستگاه‌ها را لغو می‌کند.',
              'Turning this off and saving revokes all device subscriptions.',
            )}
            disabled={!ws.configured}
          />
          <div className="form-actions">
            <Button type="submit" busy={action.pending} disabled={!ws.configured}>
              {t('ذخیره‌ی انتخاب‌ها', 'Save my choices')}
            </Button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h2>{t('دستگاه‌های من', 'My devices')}</h2>
          <Smartphone size={19} />
        </div>
        <p className="panel-subtitle">
          {t(
            'در وب، ارسال به کلیدهای VAPID و زمان‌بندی سرور نیاز دارد. iOS وب ممکن است نصب روی صفحه‌ی اصلی را لازم داشته باشد.',
            'Web delivery needs VAPID keys and the server scheduler. iOS web may require installation on the home screen.',
          )}
        </p>
        <Button variant="secondary" disabled={!ws.configured} onClick={() => setExplain(true)}>
          <Bell size={15} />
          {t('فعال‌سازی در این دستگاه', 'Enable on this device')}
        </Button>
        {data?.devices.map((device) => (
          <div className="device-row" key={device.id}>
            <Smartphone size={17} />
            <div>
              <h3>
                {device.transport === 'web'
                  ? t('مرورگر وب', 'Web browser')
                  : device.transport === 'apns'
                    ? 'iOS · APNs'
                    : 'Android · FCM'}
              </h3>
              <p>{formatDate(device.created_at, locale, timezone)}</p>
            </div>
            <ConfirmButton
              variant="ghost"
              title={t('لغو اشتراک این دستگاه؟', 'Revoke this device?')}
              description={t(
                'پوش جدیدی برای این ثبت دستگاه ارسال نمی‌شود.',
                'No new pushes will be sent to this device subscription.',
              )}
              onConfirm={async () => {
                await action.run({
                  type: 'notifications.unsubscribe',
                  device_id: device.device_id,
                });
              }}
            >
              <Trash2 size={14} />
            </ConfirmButton>
          </div>
        ))}
        <div className="privacy-explainer">
          <ShieldCheck size={17} />
          <p>
            {t(
              'تحویل تضمین نمی‌شود. پوش فقط خبر می‌دهد که در فضای خصوصی‌ات چیزی تازه است. اتصال FCM/APNs سمت سرور در این نسخه به پیاده‌سازی و اعتبارنامه‌ی میزبان نیاز دارد؛ ثبت توکن به‌تنهایی ارسال واقعی نیست.',
              'Delivery is not guaranteed. Push only says there is an update in your private space. FCM/APNs server delivery requires an operator-provided adapter and credentials in this version; token registration alone is not delivery.',
            )}
          </p>
        </div>
      </section>
      <Modal
        open={explain}
        onClose={() => !registering && setExplain(false)}
        title={t('یک اجازه‌ی کوچک، با انتخاب تو', 'A little permission, your choice')}
      >
        <p className="muted leading">
          {t(
            'با ادامه، سیستم از تو اجازه‌ی نمایش اعلان می‌خواهد. متن پیام، نامه یا اطلاعات سلامت هرگز در پوش قرار نمی‌گیرد. می‌توانی بعداً در همین بخش یا تنظیمات دستگاه خاموشش کنی.',
            'Continuing will ask your device for notification permission. Message bodies, letters and health details are never included in push payloads. You can turn this off here or in device settings.',
          )}
        </p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setExplain(false)} disabled={registering}>
            {t('فعلاً نه', 'Not now')}
          </Button>
          <Button
            busy={registering}
            onClick={async () => {
              setRegistering(true);
              try {
                const transport = await registerThisDevice();
                const updated = { ...prefs, push_enabled: true };
                const result = await action.run({
                  type: 'notifications.preferences',
                  preferences: updated,
                });
                if (result.ok) {
                  setPrefs(updated);
                  setExplain(false);
                  toast(
                    transport === 'web'
                      ? t(
                          'دستگاه ثبت شد. ارسال به تنظیمات سرور و شبکه بستگی دارد.',
                          'Device registered. Delivery depends on server configuration and connectivity.',
                        )
                      : t(
                          'توکن دستگاه ثبت شد؛ ارسال بومی در انتظار اتصال سرویس‌دهنده است.',
                          'Device token registered; native delivery is awaiting the provider adapter.',
                        ),
                  );
                }
              } catch (error) {
                toast(errorText(error, t), 'error');
              } finally {
                setRegistering(false);
              }
            }}
          >
            {t('ادامه و درخواست اجازه', 'Continue and ask permission')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
export function NotificationsScreen() {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const query = useData<NotificationData>('notifications', {}, false);
  const action = useAction();
  useRealtime(['notifications']);
  return (
    <>
      <PageHeader
        eyebrow="A FEW QUIET UPDATES"
        title={t('خبرهای کوچکِ ما', 'Our little updates')}
        description={t(
          'فقط چیزهایی که انتخاب می‌کنی بشنوی.',
          'Only the things you choose to hear about.',
        )}
        action={
          <Button
            variant="secondary"
            disabled={!ws.configured || !query.data?.items.some((n) => !n.read_at)}
            busy={action.pending}
            onClick={() => void action.run({ type: 'notifications.read' })}
          >
            <CheckCheck size={17} />
            {t('همه خوانده شد', 'Mark all read')}
          </Button>
        }
      />
      <SetupNotice />
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="two-column">
          <section className="panel">
            <div className="panel-header">
              <h2>{t('صندوق خبرها', 'Your update inbox')}</h2>
              <Bell size={19} />
            </div>
            {query.data?.items.length ? (
              query.data.items.map((item) => {
                const kind = kinds[item.kind as keyof typeof kinds];
                return (
                  <article
                    className={`notification-item ${item.read_at ? 'read' : ''}`}
                    key={item.id}
                  >
                    <div className="notification-icon">
                      <kind.icon size={19} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3>
                        {t(kind.fa, kind.en)}
                        {!item.read_at && <span className="notification-dot" />}
                      </h3>
                      <p>
                        {formatDate(item.created_at, locale, timezone, { year: undefined })} ·{' '}
                        {formatTime(item.created_at, locale, timezone)}
                      </p>
                      <Link
                        href={item.href}
                        className="text-link"
                        onClick={() => void action.run({ type: 'notifications.read', id: item.id })}
                      >
                        {t('دیدن در فضای خودمان', 'Open in our space')}
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState
                compact
                icon={Bell}
                title={t('فعلاً همه‌چیز آرام است.', 'It’s quiet here for now.')}
                description={t(
                  'خبرهای تازه و یادآورهای انتخاب‌شده، همین‌جا قرار می‌گیرند.',
                  'New updates and the reminders you choose will find a home here.',
                )}
              />
            )}
          </section>
          <Preferences key={query.data?.preferences.owner_id || 'setup'} data={query.data} />
        </div>
      )}
    </>
  );
}
