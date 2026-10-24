'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Link2,
  Copy,
  Check,
  LockKeyhole,
  KeyRound,
  MessageCircle,
  UsersRound,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import { Button, Field, LinkButton, PageHeader, SetupNotice } from '@/components/ui/primitives';
import { useAction } from '@/hooks/use-data';
import { todayISO, formatTime } from '@/lib/dates';
import { normalizePairingCode, pairingPattern } from '@/lib/pairing';

export function InvitationCreator() {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const action = useAction();
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'code' | 'link'>('code');
  const [expires, setExpires] = useState('');
  const [copied, setCopied] = useState(false);
  if (ws.members.length >= 2) return null;
  const disabled = !ws.configured || !ws.couple || action.pending;
  return (
    <div className="pairing-creator">
      <div className="button-row">
        <Button
          busy={action.pending}
          disabled={disabled}
          onClick={async () => {
            const result = await action.run<{ code: string; invitation: { expires_at: string } }>({
              type: 'invitation.code.create',
            });
            if (result.ok) {
              setValue(result.data.code);
              setKind('code');
              setExpires(result.data.invitation.expires_at);
              setCopied(false);
            }
          }}
        >
          <KeyRound size={17} />
          {t('ساخت کد اختصاصی اتصال', 'Create a private pairing code')}
        </Button>
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={async () => {
            const result = await action.run<{ url: string }>({ type: 'invitation.create' });
            if (result.ok) {
              setValue(result.data.url);
              setKind('link');
              setExpires('');
              setCopied(false);
            }
          }}
        >
          <Link2 size={16} />
          {t('به‌جای کد، پیوند بساز', 'Use a link instead')}
        </Button>
      </div>
      {value && (
        <>
          <div className={`invite-link ${kind === 'code' ? 'pairing-code-display' : ''}`}>
            <input
              value={value}
              readOnly
              dir="ltr"
              aria-label={
                kind === 'code'
                  ? t('کد خصوصی اتصال', 'Private pairing code')
                  : t('پیوند دعوت خصوصی', 'Private invitation link')
              }
              onFocus={(event) => event.target.select()}
            />
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value);
                  setCopied(true);
                } catch {
                  toast(
                    t('مقدار را انتخاب و دستی کپی کن.', 'Select and copy it manually.'),
                    'error',
                  );
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {t('کپی', 'Copy')}
            </Button>
          </div>
          <p className="field-hint">
            {kind === 'code'
              ? t(
                  'فقط برای همراهت بفرست. کد یک‌بارمصرف است و ۱۵ دقیقه اعتبار دارد.',
                  'Only send it to your partner. This single-use code expires in 15 minutes.',
                )
              : t(
                  'پیوند یک‌بارمصرف است و ۴۸ ساعت اعتبار دارد.',
                  'This single-use link expires in 48 hours.',
                )}{' '}
            {expires && (
              <span>
                {t('اعتبار تا: ', 'Valid until: ')}
                {formatTime(expires, locale, timezone)}
              </span>
            )}
          </p>
        </>
      )}
      <p className="field-hint">
        {t(
          'ساخت کد یا پیوند تازه، دعوت قبلی را باطل می‌کند. بعد از اتصال، برای ادامهٔ چت دیگر نیازی به کد نیست.',
          'A new code or link revokes the previous invitation. After pairing, you don’t need a code again to keep chatting.',
        )}
      </p>
    </div>
  );
}
function JoinCode() {
  const { t } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const enabled = ws.configured && !!ws.userId && !ws.couple;
  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        if (!pairingPattern.test(normalizePairingCode(code))) {
          setError(
            t(
              'کد ۱۲ کاراکتری همراهت را وارد کن؛ خط تیره و فاصله مهم نیست.',
              'Enter your partner’s 12-character code; spaces and hyphens are optional.',
            ),
          );
          return;
        }
        const result = await action.run({ type: 'invitation.code.accept', code });
        if (result.ok) {
          setCode('');
          router.replace('/chat');
          router.refresh();
        }
      }}
    >
      <Field
        label={t('کدی که همراهت فرستاده', 'The code your partner sent')}
        hint={t(
          'کد را فقط پس از ورود به حساب خودت وارد کن.',
          'Enter the code only after signing into your own account.',
        )}
        error={error || undefined}
      >
        <input
          className="pairing-code-input"
          dir="ltr"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          disabled={!enabled}
        />
      </Field>
      <Button type="submit" busy={action.pending} disabled={!enabled}>
        <UsersRound size={17} />
        {t('اتصال و شروع گفت‌وگو', 'Connect and start chatting')}
      </Button>
    </form>
  );
}
export function PairingPanel({ preview = false }: { preview?: boolean }) {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const [start, setStart] = useState('');
  const [choice, setChoice] = useState<'join' | 'create'>('join');
  if (ws.members.length >= 2)
    return (
      <section className="panel pairing-connected">
        <span className="pairing-success-icon">
          <Check size={25} />
        </span>
        <h2>{t('فضای دونفرهٔ شما متصل است.', 'Your two-person space is connected.')}</h2>
        <p>{ws.members.map((member) => member.display_name).join(' · ')}</p>
        <LinkButton href="/chat">
          <MessageCircle size={18} />
          {t('رفتن به گفت‌وگوی ما', 'Open our conversation')}
        </LinkButton>
      </section>
    );
  if (!preview && (!ws.configured || !ws.userId)) return null;
  return (
    <section className="onboarding-panel pairing-panel">
      <div className="eyebrow" dir="ltr">
        ONE CODE. JUST TWO PEOPLE.
      </div>
      <h2>
        {ws.couple
          ? t('یک جای خالی، برای همراهت.', 'One place, saved for your person.')
          : t('با یک کد، کنار هم.', 'One code brings you together.')}
      </h2>
      <p>
        {t(
          'فقط یکی از شما فضای دونفره می‌سازد؛ نفر دوم کد او را در حساب خودش وارد می‌کند. هر فضا فقط دو عضو دارد.',
          'Only one of you creates a space. The other enters their code in their own account. Every space has exactly two places.',
        )}
      </p>
      {ws.couple ? (
        <InvitationCreator />
      ) : (
        <>
          <div className="segmented-tabs pairing-tabs">
            <button
              type="button"
              className={choice === 'join' ? 'active' : ''}
              aria-pressed={choice === 'join'}
              onClick={() => setChoice('join')}
            >
              <KeyRound size={17} />
              {t('کد همراهَم را دارم', 'I have their code')}
            </button>
            <button
              type="button"
              className={choice === 'create' ? 'active' : ''}
              aria-pressed={choice === 'create'}
              onClick={() => setChoice('create')}
            >
              <Heart size={17} />
              {t('من دعوت می‌کنم', 'I’ll send the invitation')}
            </button>
          </div>
          {choice === 'join' ? (
            <JoinCode />
          ) : (
            <form
              className="form-stack"
              onSubmit={async (event) => {
                event.preventDefault();
                await action.run({ type: 'couple.create', relationship_start: start || null });
              }}
            >
              <Field
                label={t('شروع رابطه (اختیاری)', 'Relationship start (optional)')}
                hint={t(
                  'با تقویم دستگاه وارد کن؛ می‌توانی بعداً اضافه کنی.',
                  'Use your device’s date input; you can add it later.',
                )}
              >
                <input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  max={todayISO(timezone)}
                  disabled={!ws.configured || !ws.userId}
                />
              </Field>
              <Button type="submit" busy={action.pending} disabled={!ws.configured || !ws.userId}>
                <Heart size={17} />
                {t('ساخت فضای ما؛ سپس دریافت کد', 'Create our space, then get a code')}
              </Button>
            </form>
          )}
        </>
      )}
      <p className="inline-note">
        <LockKeyhole size={14} />
        {t(
          'دانستن کد به‌تنهایی کافی نیست: ورود به حساب و پذیرش امن دعوت لازم است. اطلاعات خصوصی چرخه همراه کد منتقل نمی‌شوند.',
          'Knowing a code alone grants no data access: sign-in and secure acceptance are required. Private cycle data never travels with the code.',
        )}
      </p>
    </section>
  );
}
export function Onboarding() {
  return <PairingPanel />;
}
export function PairingScreen() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        eyebrow="JUST THE TWO OF YOU"
        title={t('اتصال دونفره', 'Connect with your person')}
        description={t(
          'یک فایل برنامه، دو حساب مستقل و یک فضای خصوصی مشترک.',
          'One app, two separate accounts, one private shared space.',
        )}
      />
      <SetupNotice />
      <PairingPanel preview />
    </>
  );
}
