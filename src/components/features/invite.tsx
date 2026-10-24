'use client';
import { Heart, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n, useWorkspace } from '@/components/providers';
import { PublicHeader } from '@/components/layout/app-shell';
import { Button, LinkButton, SetupNotice } from '@/components/ui/primitives';
import { useAction } from '@/hooks/use-data';
export function InviteScreen({ token }: { token: string }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const router = useRouter();
  const action = useAction();
  return (
    <>
      <PublicHeader />
      <main className="invite-page">
        <div className="invite-emblem">
          <Heart size={40} strokeWidth={1.2} />
        </div>
        <div className="eyebrow" dir="ltr" style={{ margin: '0 auto 15px' }}>
          A PLACE SAVED FOR YOU
        </div>
        <h1>{t('یک نفر، جایت را نگه داشته.', 'Someone saved you a place.')}</h1>
        <p>
          {t(
            'این یک دعوت خصوصی به دنیایی دونفره است. ابتدا وارد حساب خودت شو؛ بعد، دعوت به‌صورت امن بررسی می‌شود. قبل از پذیرش، هیچ اطلاعاتی از آن فضا نمایش داده نمی‌شود.',
            'This is an invitation to a private little world for two. Sign in to your own account, then we’ll securely check the invitation. Nothing from the space is visible before acceptance.',
          )}
        </p>
        <SetupNotice />
        {ws.userId ? (
          <Button
            busy={action.pending}
            disabled={!!ws.couple}
            onClick={async () => {
              const result = await action.run({ type: 'invitation.accept', token });
              if (result.ok) {
                router.replace('/home');
                router.refresh();
              }
            }}
          >
            <Heart size={17} />
            {ws.couple
              ? t('شما از قبل عضو یک فضا هستید', 'You already belong to a space')
              : t('پذیرفتن دعوت', 'Accept this invitation')}
          </Button>
        ) : (
          <>
            <LinkButton href={`/login?next=${encodeURIComponent('/invite/' + token)}`}>
              {t('ورود و بررسی دعوت', 'Sign in to accept')}
            </LinkButton>
            <LinkButton
              href={`/signup?next=${encodeURIComponent('/invite/' + token)}`}
              variant="secondary"
            >
              {t('ساخت حساب من', 'Create my account')}
            </LinkButton>
          </>
        )}
        <p className="inline-note">
          <LockKeyhole size={13} />
          {t(
            'دعوت‌ها یک‌بارمصرف، زمان‌دار و قابل لغو هستند.',
            'Invitations are single-use, expiring, and revocable.',
          )}
        </p>
      </main>
    </>
  );
}
