'use client';
import { useState } from 'react';
import { Heart, Link2, Copy, Check, LockKeyhole } from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import { Button, Field } from '@/components/ui/primitives';
import { useAction } from '@/hooks/use-data';
import { todayISO } from '@/lib/dates';
export function InvitationCreator() {
  const { t } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const action = useAction();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  if (ws.members.length >= 2) return null;
  return (
    <div>
      <Button
        variant="secondary"
        busy={action.pending}
        disabled={!ws.configured || !ws.couple}
        onClick={async () => {
          const result = await action.run<{ url: string }>({ type: 'invitation.create' });
          if (result.ok) {
            setUrl(result.data.url);
            setCopied(false);
          }
        }}
      >
        <Link2 size={16} />
        {t('ساخت پیوند دعوت خصوصی', 'Create a private invitation')}
      </Button>
      {url && (
        <>
          <div className="invite-link">
            <input
              value={url}
              readOnly
              aria-label={t('پیوند دعوت خصوصی', 'Private invitation link')}
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  toast(
                    t('پیوند را انتخاب و دستی کپی کنید.', 'Select and copy the link manually.'),
                    'error',
                  );
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {t('کپی', 'Copy')}
            </Button>
          </div>
          <p className="field-hint" style={{ marginTop: 9 }}>
            {t(
              'فقط برای همراهتان بفرستید. این پیوند یک‌بارمصرف است و ۴۸ ساعت اعتبار دارد. ساخت پیوند تازه، قبلی را باطل می‌کند.',
              'Only send this to your partner. It is single-use and expires in 48 hours. Creating a new link revokes the previous one.',
            )}
          </p>
        </>
      )}
    </div>
  );
}
export function Onboarding() {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const [start, setStart] = useState('');
  if (!ws.configured || !ws.userId || ws.members.length === 2) return null;
  return (
    <section className="onboarding-panel">
      <div className="eyebrow" dir="ltr">
        OUR STORY STARTS HERE
      </div>
      <h2>
        {ws.couple
          ? t('حالا، فقط جای یک نفر خالی‌ست.', 'Now, there’s room for one more.')
          : t('خانه‌ی کوچکمان را بسازیم؟', 'Shall we make a little home?')}
      </h2>
      <p>
        {ws.couple
          ? t(
              'همراهت را با یک پیوند خصوصی دعوت کن. برای پیوستن، او هم باید وارد حساب خودش شود.',
              'Invite your person with a private link. They’ll sign in with their own account to join you.',
            )
          : t(
              'یک فضای خصوصی فقط برای شما دو نفر. شروع رابطه اختیاری است؛ می‌توانی بعداً آن را اضافه کنی.',
              'A private space with exactly two places. Your relationship start date is optional; you can add it later.',
            )}
      </p>
      {ws.couple ? (
        <div style={{ marginTop: 23 }}>
          <InvitationCreator />
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await action.run({ type: 'couple.create', relationship_start: start || null });
          }}
        >
          <div className="form-grid">
            <Field
              label={t('از چه روزی «ما» شدیم؟ (اختیاری)', 'When did we become “us”? (optional)')}
              hint={t(
                'ورود تاریخ با تقویم دستگاه؛ نمایش تاریخ‌ها به زبان انتخابی شماست.',
                'Use your device’s date input; dates display in your chosen calendar.',
              )}
            >
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                max={todayISO(timezone)}
              />
            </Field>
            <div style={{ alignSelf: 'center' }}>
              <Button type="submit" busy={action.pending}>
                <Heart size={17} />
                {t('ساخت فضای دونفره‌ی ما', 'Create our space')}
              </Button>
            </div>
          </div>
        </form>
      )}
      <p className="inline-note" style={{ marginTop: 19 }}>
        <LockKeyhole size={12} />
        {t(
          'پیوند دعوت به‌تنهایی اجازه‌ی دیدن داده‌های خصوصی را نمی‌دهد.',
          'An invitation link alone never grants access to private data.',
        )}
      </p>
    </section>
  );
}
