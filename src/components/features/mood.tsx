'use client';
import { useState } from 'react';
import { Heart, LockKeyhole, Trash2, ShieldCheck, PenLine } from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Field,
  Select,
  Toggle,
  ConfirmButton,
  Badge,
} from '@/components/ui/primitives';
import { useAction, useData } from '@/hooks/use-data';
import { moods, type MoodKind } from '@/lib/moods';
import { formatDate, todayISO } from '@/lib/dates';
import type { Mood } from '@/types/models';
export function MoodScreen({ initialMood }: { initialMood?: string }) {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const query = useData<Mood[]>('moods', {}, false);
  const action = useAction();
  const [selected, setSelected] = useState<MoodKind | null>(
    moods.some((m) => m.id === initialMood) ? (initialMood as MoodKind) : null,
  );
  const [note, setNote] = useState('');
  const [shared, setShared] = useState(false);
  const [hours, setHours] = useState(24);
  const enabled = ws.configured && !!ws.userId;
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE SPACE TO FEEL"
        title={t('هر حالی که داری، پذیرفتنی‌ست.', 'However you feel, there’s room for it.')}
        description={t(
          'بدون قضاوت، بدون امتیاز. فقط یک لحظه برای شنیدن خودت.',
          'No judgement. No scores. Just a moment to listen to yourself.',
        )}
      />
      <SetupNotice />
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h2>{t('امروز، حالت چطور است؟', 'How are you feeling today?')}</h2>
            <Heart size={20} />
          </div>
          <div
            className="mood-select"
            role="group"
            aria-label={t('انتخاب حال‌وهوای امروز', 'Choose today’s mood')}
          >
            {moods.map((mood) => (
              <button
                key={mood.id}
                className={`mood-option ${selected === mood.id ? 'active' : ''}`}
                aria-pressed={selected === mood.id}
                onClick={() => setSelected(mood.id)}
              >
                <mood.icon size={27} />
                <span>{t(mood.fa, mood.en)}</span>
              </button>
            ))}
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected) return;
              const result = await action.run({
                type: 'mood.save',
                mood: selected,
                note,
                shared,
                visible_hours: hours,
              });
              if (result.ok)
                toast(
                  t(
                    'حال‌وهوایت با انتخاب‌های خودت ذخیره شد.',
                    'Your check-in was saved with your choices.',
                  ),
                );
            }}
          >
            <Field
              label={t('یک یادداشت، فقط برای خودت (اختیاری)', 'A note, just for you (optional)')}
              hint={t(
                'حتی اگر حال‌وهوا را شریک شوی، این یادداشت خصوصی می‌ماند.',
                'This note stays private even when your mood is shared.',
              )}
            >
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={4}
                disabled={!enabled}
                placeholder={t('می‌خواهم یادم بماند که…', 'Something I want to remember…')}
              />
            </Field>
            <Toggle
              checked={shared}
              onChange={setShared}
              disabled={!enabled || !ws.couple}
              label={t('حال‌وهوایم را با همراهم شریک شو', 'Share my mood with my partner')}
              description={t(
                'فقط همین حال‌وهوا؛ نه یادداشت، نه تاریخچه‌ی خصوصی.',
                'Only this mood. Not your note or private history.',
              )}
            />
            <Field label={t('تا چه مدت دیده شود؟', 'How long should it be visible?')}>
              <Select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                disabled={!enabled}
              >
                {[1, 8, 24, 72, 168].map((value) => (
                  <option value={value} key={value}>
                    {new Intl.NumberFormat(locale).format(value)} {t('ساعت', 'hours')}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" busy={action.pending} disabled={!enabled || !selected}>
              <Heart size={16} />
              {t('ثبت حالِ امروز من', 'Save my little check-in')}
            </Button>
          </form>
          <div className="privacy-explainer">
            <ShieldCheck size={17} />
            <p>
              {t(
                'هر لحظه می‌توانی اشتراک را خاموش یا ورودی را حذف کنی. هیچ امتیاز، رتبه‌بندی یا نظارتی بر همراهت وجود ندارد.',
                'You can stop sharing or remove an entry at any time. There are no scores, rankings, or partner-monitoring features.',
              )}
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>{t('روزهای من، حال‌های من', 'My days, my feelings')}</h2>
            <LockKeyhole size={18} />
          </div>
          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} retry={() => void query.refetch()} />
          ) : query.data?.length ? (
            query.data.map((entry) => {
              const mood = moods.find((m) => m.id === entry.mood)!;
              const owner = entry.owner_id === ws.userId;
              const live = new Date(entry.expires_at) > new Date();
              return (
                <article className="mood-history" key={entry.id}>
                  <div className="mood-history-icon">
                    <mood.icon size={23} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3>
                      {t(mood.fa, mood.en)}{' '}
                      {!owner &&
                        `· ${ws.members.find((m) => m.id === entry.owner_id)?.display_name || t('همراهت', 'Your partner')}`}
                    </h3>
                    <p>{formatDate(entry.local_date, locale, 'UTC', { year: undefined })}</p>
                    {owner && entry.mood_notes?.note && (
                      <p className="private-note">
                        <LockKeyhole size={11} style={{ display: 'inline', marginInlineEnd: 5 }} />
                        {entry.mood_notes.note}
                      </p>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Badge>
                        {entry.shared && live
                          ? t('با انتخاب من، مشترک', 'Shared by choice')
                          : t('فقط خودم', 'Just me')}
                      </Badge>
                    </div>
                  </div>
                  {owner && (
                    <div className="record-actions">
                      {entry.local_date === todayISO(timezone) && (
                        <button
                          className="icon-button"
                          aria-label={t('ویرایش حال امروز', 'Edit today’s mood')}
                          onClick={() => {
                            setSelected(entry.mood as MoodKind);
                            setNote(entry.mood_notes?.note || '');
                            setShared(entry.shared);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <PenLine size={14} />
                        </button>
                      )}
                      <ConfirmButton
                        variant="ghost"
                        title={t('حذف این حال‌وهوا؟', 'Remove this check-in?')}
                        description={t(
                          'یادداشت خصوصی و دسترسی همراهت هم حذف می‌شود.',
                          'The private note and your partner’s access will also be removed.',
                        )}
                        onConfirm={async () => {
                          await action.run({ type: 'mood.delete', id: entry.id });
                        }}
                      >
                        <Trash2 size={14} />
                      </ConfirmButton>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState
              compact
              icon={Heart}
              title={t('از حالِ امروز شروع کنیم.', 'Let’s start with today.')}
              description={t(
                'هیچ تاریخچه‌ی ساختگی اینجا نیست. وقتی آماده بودی، اولین حال‌وهوا را ثبت کن.',
                'When you’re ready, give your first feeling a place here.',
              )}
            />
          )}
        </section>
      </div>
    </>
  );
}
