'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import {
  Mail,
  Plus,
  Heart,
  PenLine,
  Send,
  Clock3,
  LockKeyhole,
  Gift,
  Trash2,
  X,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import { useAction, useData } from '@/hooks/use-data';
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
  Toggle,
  ConfirmButton,
  Badge,
} from '@/components/ui/primitives';
import { UploadField, PrivateMedia } from '@/components/ui/media';
import { formatDate, formatTime, localToUtc, utcToLocal } from '@/lib/dates';
import type { Asset, Letter } from '@/types/models';
const letterFormSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20000),
  occasion: z.string().max(100),
  gift_message: z.string().max(500),
});
function LetterComposer({ initial, onSaved }: { initial: Letter | null; onSaved: () => void }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const [assets, setAssets] = useState<Asset[]>(
    initial?.upload_assets ? [initial.upload_assets] : [],
  );
  const [uploading, setUploading] = useState(false);
  const form = useForm({
    resolver: zodResolver(letterFormSchema),
    defaultValues: {
      title: initial?.title || '',
      body: initial?.body || '',
      occasion: initial?.occasion || '',
      gift_message: initial?.gift_message || '',
    },
  });
  const enabled = ws.configured && !!ws.couple;
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(async (fields) => {
        const result = await action.run({
          type: 'letter.save',
          id: initial?.id,
          ...fields,
          asset_id: assets[0]?.id || null,
        });
        if (result.ok) onSaved();
      })}
    >
      <Field
        label={t('عنوان نامه', 'A title for your letter')}
        error={
          form.formState.errors.title
            ? t('یک عنوان کوتاه بنویس.', 'Write a short title.')
            : undefined
        }
      >
        <input
          {...form.register('title')}
          maxLength={120}
          disabled={!enabled}
          placeholder={t('برای تو، که…', 'For you, because…')}
        />
      </Field>
      <Field
        label={t('از دلت بنویس', 'Write from the heart')}
        error={
          form.formState.errors.body
            ? t('نامه هنوز کلمه‌ای ندارد.', 'Your letter needs a few words.')
            : undefined
        }
      >
        <textarea
          {...form.register('body')}
          maxLength={20000}
          rows={9}
          disabled={!enabled}
          placeholder={t('عزیزِ من،\n\nگاهی فکر می‌کنم…', 'My love,\n\nSometimes I think…')}
          style={{ background: 'var(--cream)', lineHeight: 2.2 }}
        />
      </Field>
      <div className="form-grid">
        <Field label={t('به چه مناسبت؟ (اختیاری)', 'An occasion? (optional)')}>
          <input {...form.register('occasion')} maxLength={100} disabled={!enabled} />
        </Field>
        <Field label={t('پیام هدیه (اختیاری)', 'A gift note (optional)')}>
          <input {...form.register('gift_message')} maxLength={500} disabled={!enabled} />
        </Field>
      </div>
      <UploadField
        kind="letter"
        assets={assets}
        onChange={setAssets}
        max={1}
        disabled={!enabled}
        onBusyChange={setUploading}
      />
      <p className="inline-note">
        <LockKeyhole size={13} />
        {t(
          'پیش‌نویس فقط برای توست. پس از ذخیره، زمان ارسال را انتخاب کن.',
          'Drafts are only visible to you. Save first, then choose when it can be opened.',
        )}
      </p>
      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={onSaved}>
          {t('انصراف', 'Cancel')}
        </Button>
        <Button type="submit" busy={action.pending} disabled={!enabled || uploading}>
          <PenLine size={16} />
          {t('ذخیره‌ی پیش‌نویس', 'Save my draft')}
        </Button>
      </div>
    </form>
  );
}
export function LettersScreen({ composeInitially = false }: { composeInitially?: boolean }) {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const query = useData<Letter[]>('letters');
  const action = useAction();
  const [tab, setTab] = useState<'received' | 'sent' | 'drafts'>('received');
  const [compose, setCompose] = useState(composeInitially);
  const [editing, setEditing] = useState<Letter | null>(null);
  const [opened, setOpened] = useState<Letter | null>(null);
  const [sending, setSending] = useState<Letter | null>(null);
  const [schedule, setSchedule] = useState(false);
  const [release, setRelease] = useState(utcToLocal(new Date().toISOString(), timezone));
  const [dateError, setDateError] = useState('');
  const items = (query.data || []).filter((l) =>
    tab === 'drafts'
      ? l.sender_id === ws.userId && l.state === 'draft'
      : tab === 'sent'
        ? l.sender_id === ws.userId && l.state !== 'draft'
        : l.recipient_id === ws.userId,
  );
  const stateLabel = (l: Letter) =>
    l.state === 'draft'
      ? t('پیش‌نویس', 'Draft')
      : l.state === 'opened'
        ? t('باز شده', 'Opened')
        : l.state === 'cancelled'
          ? t('لغوشده', 'Cancelled')
          : l.release_at && new Date(l.release_at) > new Date()
            ? t('برای روزی دیگر', 'For another day')
            : t('آماده‌ی بازشدن', 'Ready to open');
  return (
    <>
      <PageHeader
        eyebrow="OUR LITTLE LETTERBOX"
        title={t('نامه‌هایی از دل', 'Letters from the heart')}
        description={t(
          'برای همین حالا، یا وقتی که زمانش برسد.',
          'For this very moment, or when the time is right.',
        )}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setCompose(true);
            }}
          >
            <Plus size={17} />
            {t('نامه‌ی تازه', 'Write a letter')}
          </Button>
        }
      />
      <SetupNotice />
      <MembershipNotice />
      <div className="tab-bar" role="tablist" aria-label={t('صندوق نامه', 'Letterbox')}>
        {[
          { id: 'received', fa: 'برای من', en: 'For me' },
          { id: 'sent', fa: 'از طرف من', en: 'From me' },
          { id: 'drafts', fa: 'پیش‌نویس‌ها', en: 'My drafts' },
        ].map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
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
      ) : items.length ? (
        <div className="letter-grid">
          {items.map((letter) => (
            <article className="letter-card" key={letter.id}>
              <Badge>{stateLabel(letter)}</Badge>
              <div className="envelope-art" aria-hidden="true">
                <Heart />
              </div>
              <h3>{letter.title}</h3>
              <p>
                {letter.release_at
                  ? formatDate(letter.release_at, locale, timezone)
                  : formatDate(letter.created_at, locale, timezone)}
                {letter.occasion ? ` · ${letter.occasion}` : ''}
              </p>
              <div className="letter-actions">
                {letter.state === 'draft' ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(letter);
                        setCompose(true);
                      }}
                    >
                      <PenLine size={13} />
                      {t('ویرایش', 'Edit')}
                    </Button>
                    <Button
                      onClick={() => {
                        setSending(letter);
                        setDateError('');
                      }}
                    >
                      <Send size={13} />
                      {t('ارسال', 'Send')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (letter.recipient_id === ws.userId && letter.state !== 'opened') {
                        const result = await action.run({ type: 'letter.open', id: letter.id });
                        if (!result.ok) return;
                      }
                      setOpened(letter);
                    }}
                  >
                    <Mail size={14} />
                    {letter.sender_id === ws.userId
                      ? t('دیدن نامه‌ی خودم', 'View my letter')
                      : t('بازکردن نامه', 'Open my letter')}
                  </Button>
                )}
                {letter.sender_id === ws.userId &&
                  letter.state === 'scheduled' &&
                  letter.release_at &&
                  new Date(letter.release_at) > new Date() && (
                    <ConfirmButton
                      variant="ghost"
                      title={t('ارسال این نامه لغو شود؟', 'Cancel this letter?')}
                      description={t(
                        'همراهت دیگر این نامه را دریافت نخواهد کرد.',
                        'Your partner will no longer receive this letter.',
                      )}
                      onConfirm={async () => {
                        await action.run({ type: 'letter.cancel', id: letter.id });
                      }}
                    >
                      <X size={13} />
                    </ConfirmButton>
                  )}
                {letter.sender_id === ws.userId &&
                  ['draft', 'cancelled'].includes(letter.state) && (
                    <ConfirmButton
                      variant="ghost"
                      title={t('حذف این نامه؟', 'Delete this letter?')}
                      description={t('این کار قابل بازگشت نیست.', 'This cannot be undone.')}
                      onConfirm={async () => {
                        await action.run({ type: 'letter.delete', id: letter.id });
                      }}
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            icon={Mail}
            title={
              tab === 'received'
                ? t('هنوز پاکتی برای بازکردن نیست.', 'No little envelopes to open yet.')
                : t('بعضی حرف‌ها منتظر نوشته‌شدن‌اند.', 'Some words are waiting to be written.')
            }
            description={t(
              'نامه‌های زمان‌بندی‌شده‌ی همراهت تا زمان انتشار حتی قابل دریافت نیستند. پیش‌نویس‌ها فقط برای نویسنده‌اند.',
              'Your partner’s scheduled letters cannot even be retrieved before release. Drafts are visible only to their writer.',
            )}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setCompose(true);
                }}
              >
                <PenLine size={15} />
                {t('از یک جمله شروع کن', 'Start with a sentence')}
              </Button>
            }
          />
        </section>
      )}
      <div className="privacy-explainer">
        <LockKeyhole size={17} />
        <p>
          {t(
            'زمان بازشدن روی سرور بررسی می‌شود، نه فقط در این صفحه. پس از ارسال، متن و زمان نامه قفل می‌شود. اعلانِ زمان انتشار به کار زمان‌بندی‌شده‌ی سرور نیاز دارد.',
            'Release times are enforced on the server, not just on this screen. Sending locks the content and release time. Release notifications require the configured server scheduler.',
          )}
        </p>
      </div>
      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title={
          editing
            ? t('ادامه‌ی نامه‌ات', 'Continue your letter')
            : t('برای تو، از من', 'To you, from me')
        }
        wide
      >
        <LetterComposer
          initial={editing}
          onSaved={() => {
            setCompose(false);
            setTab('drafts');
          }}
        />
      </Modal>
      <Modal
        open={!!sending}
        onClose={() => setSending(null)}
        title={t('کی به دستش برسد؟', 'When should it reach them?')}
      >
        <div className="form-stack">
          <p className="muted leading">
            {t(
              'پس از ارسال، متن و زمان نامه تغییر نمی‌کند. برای اطمینان، یک‌بار دیگر بخوانش.',
              'Once sent, its words and release time cannot change. Read it once more, just to be sure.',
            )}
          </p>
          <Toggle
            checked={schedule}
            onChange={setSchedule}
            label={t('برای یک لحظه‌ی خاص نگهش دار', 'Save it for a special moment')}
          />
          {schedule && (
            <Field label={t('زمان بازشدن', 'Opening time')} hint={timezone} error={dateError}>
              <input
                type="datetime-local"
                value={release}
                onChange={(e) => setRelease(e.target.value)}
                required
              />
            </Field>
          )}
          <Button
            disabled={ws.members.length < 2}
            busy={action.pending}
            onClick={async () => {
              if (!sending) return;
              let date = new Date().toISOString();
              if (schedule) {
                try {
                  date = localToUtc(release, timezone);
                  if (new Date(date) <= new Date()) throw new Error('past');
                } catch {
                  setDateError(
                    t(
                      'زمانی در آینده و خارج از ساعت مبهم تغییر ساعت تابستانی انتخاب کن.',
                      'Choose an unambiguous future time, outside a daylight-saving clock transition.',
                    ),
                  );
                  return;
                }
              }
              const result = await action.run({
                type: 'letter.send',
                id: sending.id,
                release_at: date,
              });
              if (result.ok) {
                setSending(null);
                setTab('sent');
                toast(
                  t(
                    'نامه با زمان انتخابی ذخیره و ارسال شد.',
                    'Your letter was sent with its chosen release time.',
                  ),
                );
              }
            }}
          >
            <Send size={16} />
            {schedule
              ? t('ارسال برای زمان انتخابی', 'Send for the chosen time')
              : t('همین حالا بفرست', 'Send it now')}
          </Button>
          {ws.members.length < 2 && (
            <p className="field-hint">
              {t(
                'همراهت باید ابتدا دعوت را بپذیرد.',
                'Your partner needs to accept their invitation first.',
              )}
            </p>
          )}
        </div>
      </Modal>
      <Modal open={!!opened} onClose={() => setOpened(null)} title={opened?.title || ''} wide>
        {opened && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="detail-meta">
              <span>
                <Heart size={13} />
                {ws.members.find((m) => m.id === opened.sender_id)?.display_name}
              </span>
              {opened.release_at && (
                <span>
                  <Clock3 size={13} />
                  {formatDate(opened.release_at, locale, timezone)} ·{' '}
                  {formatTime(opened.release_at, locale, timezone)}
                </span>
              )}
            </div>
            <div className="letter-paper">{opened.body}</div>
            {opened.upload_assets && (
              <PrivateMedia
                asset={opened.upload_assets}
                alt={t('تصویر همراه نامه', 'A picture with your letter')}
                className="letter-image"
              />
            )}
            {opened.gift_message && (
              <div className="letter-gift">
                <Gift size={18} />
                <span>{opened.gift_message}</span>
              </div>
            )}
            <p
              className="handwritten"
              dir="ltr"
              style={{ textAlign: 'center', color: 'var(--rose)', marginTop: 25 }}
            >
              yours, always.
            </p>
          </motion.div>
        )}
      </Modal>
    </>
  );
}
