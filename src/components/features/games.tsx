'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Heart,
  ArrowLeftRight,
  Sun,
  LockKeyhole,
  Check,
  RotateCcw,
  Camera,
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
  Field,
  Badge,
} from '@/components/ui/primitives';
import { useAction, useData, useRealtime } from '@/hooks/use-data';
import type { Game } from '@/types/models';
const gameTypes = [
  {
    id: 'know',
    icon: Heart,
    fa: 'چقدر من را می‌شناسی؟',
    en: 'How well do you know me?',
    bodyFa: 'جواب خودت و حدست درباره‌ی همراهت را بنویس. بعد از جواب هر دو، با هم کشف کنید.',
    bodyEn:
      'Write your own answer and your guess about your partner. Discover together once you both answer.',
  },
  {
    id: 'choice',
    icon: ArrowLeftRight,
    fa: 'این یا آن؟',
    en: 'This or that?',
    bodyFa: 'دو انتخاب کوچک، یک گفت‌وگوی بزرگ. بدون دیدن انتخاب هم، تصمیم بگیرید.',
    bodyEn:
      'Two little choices, one lovely conversation. Choose independently, then see each other.',
  },
  {
    id: 'daily',
    icon: Sun,
    fa: 'یک سؤال برای امروز',
    en: 'A question for today',
    bodyFa: 'روزی یک فرصت برای نزدیک‌ترشدن. جواب‌ها فقط با اجازه‌ی هر دو آشکار می‌شوند.',
    bodyEn: 'A daily invitation to get closer. Answers are revealed only after you both agree.',
  },
] as const;
function parseKnow(value: string) {
  try {
    const obj = JSON.parse(value) as { own?: string; guess?: string };
    return { own: obj.own || value, guess: obj.guess || '' };
  } catch {
    return { own: value, guess: '' };
  }
}
function Round({ game, history = false }: { game: Game; history?: boolean }) {
  const { t, locale } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [guess, setGuess] = useState('');
  const own = game.game_answers.find((a) => a.user_id === ws.userId);
  const revealed = game.game_answers.length === 2;
  const question = game.game_questions;
  const options = (locale === 'fa' ? question.options_fa : question.options_en) || [];
  const name = gameTypes.find((g) => g.id === game.game_type)!;
  async function submit(value: string) {
    await action.run({ type: 'game.answer', id: game.id, answer: value });
  }
  return (
    <section className="panel game-round">
      <div className="panel-header">
        <h2>{t(name.fa, name.en)}</h2>
        <Badge green={revealed}>
          {revealed
            ? t('وقت گفت‌وگو', 'Time to talk')
            : own
              ? t('جواب تو ثبت شده', 'Your answer is saved')
              : t('یک دور تازه', 'A new round')}
        </Badge>
      </div>
      <h2>{locale === 'fa' ? question.question_fa : question.question_en}</h2>
      {!own ? (
        <>
          {game.game_type === 'choice' ? (
            <div className="question-options">
              {options.map((option, index) => (
                <button
                  key={index}
                  disabled={action.pending}
                  onClick={() => void submit(String(index))}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(
                  game.game_type === 'know' ? JSON.stringify({ own: answer, guess }) : answer,
                );
              }}
            >
              <Field
                label={
                  game.game_type === 'know'
                    ? t('جواب من درباره‌ی خودم', 'My answer about myself')
                    : t('جوابِ خودت، با کلمات خودت', 'Your answer, in your own words')
                }
              >
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  required
                  maxLength={game.game_type === 'know' ? 800 : 2000}
                  rows={3}
                />
              </Field>
              {game.game_type === 'know' && (
                <Field
                  label={t('فکر می‌کنم جواب همراه من این است…', 'I think my partner’s answer is…')}
                >
                  <textarea
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    required
                    maxLength={800}
                    rows={3}
                  />
                </Field>
              )}
              <Button
                type="submit"
                busy={action.pending}
                disabled={!answer.trim() || (game.game_type === 'know' && !guess.trim())}
              >
                <LockKeyhole size={15} />
                {t('ثبت جواب خصوصی من', 'Save my private answer')}
              </Button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="answer-card">
            <h3>{t('جواب من', 'My answer')}</h3>
            <p>
              {game.game_type === 'choice'
                ? options[Number(own.answer)]
                : game.game_type === 'know'
                  ? parseKnow(own.answer).own
                  : own.answer}
            </p>
            {game.game_type === 'know' && (
              <>
                <h3 style={{ marginTop: 13 }}>{t('حدس من درباره‌ی تو', 'My guess about you')}</h3>
                <p>{parseKnow(own.answer).guess}</p>
              </>
            )}
          </div>
          {!revealed && (
            <div className="privacy-explainer">
              <LockKeyhole size={17} />
              <p>
                {t(
                  'جواب همراهت هنوز برای تو قابل دریافت نیست. برای نزدیک‌ترشدن عجله‌ای نداریم.',
                  'Your partner’s answer cannot be retrieved yet. There’s no rush to get closer.',
                )}
              </p>
            </div>
          )}
          {game.game_type === 'daily' && !own.reveal_consent && (
            <Button
              variant="secondary"
              busy={action.pending}
              style={{ marginTop: 18 }}
              onClick={() => void action.run({ type: 'game.reveal', id: game.id })}
            >
              <Heart size={15} />
              {t('من برای آشکارشدن هر دو جواب موافقم', 'I agree to reveal both answers')}
            </Button>
          )}
          {game.game_type === 'daily' && own.reveal_consent && !revealed && (
            <p className="inline-note" style={{ marginTop: 18 }}>
              <Check size={14} />
              {t(
                'رضایت تو ثبت شد؛ منتظر انتخاب همراهت هستیم.',
                'Your consent is saved; waiting for your partner’s choice.',
              )}
            </p>
          )}
        </>
      )}
      {revealed && (
        <>
          {game.game_answers
            .filter((a) => a.user_id !== ws.userId)
            .map((partner) => (
              <div className="answer-card" key={partner.user_id}>
                <h3>
                  {ws.members.find((m) => m.id === partner.user_id)?.display_name ||
                    t('همراه من', 'My partner')}
                </h3>
                <p>
                  {game.game_type === 'choice'
                    ? options[Number(partner.answer)]
                    : game.game_type === 'know'
                      ? parseKnow(partner.answer).own
                      : partner.answer}
                </p>
                {game.game_type === 'know' && (
                  <>
                    <h3 style={{ marginTop: 13 }}>
                      {t('حدس همراهت درباره‌ی تو', 'Your partner’s guess about you')}
                    </h3>
                    <p>{parseKnow(partner.answer).guess}</p>
                  </>
                )}
              </div>
            ))}
          <p className="inline-note" style={{ marginTop: 18 }}>
            <Heart size={14} />
            {t(
              'امتیازی در کار نیست. کدام جزئیات برایت تازه بود؟',
              'No scores here. What surprised you? What would you like to talk about?',
            )}
          </p>
          <div className="form-actions spread">
            {game.game_type === 'daily' ? (
              <Button
                variant="secondary"
                busy={action.pending}
                onClick={async () => {
                  const result = await action.run<string>({ type: 'game.memory', id: game.id });
                  if (result.ok) router.push('/memories/' + result.data);
                }}
              >
                <Camera size={15} />
                {t('نگه‌داشتن در خاطره‌ها', 'Keep as a memory')}
              </Button>
            ) : !history ? (
              <Button
                variant="secondary"
                busy={action.pending}
                onClick={() =>
                  void action.run({ type: 'game.start', kind: game.game_type as 'know' | 'choice' })
                }
              >
                <RotateCcw size={15} />
                {t('یک دور تازه', 'Another round')}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
export function GamesScreen() {
  const { t } = useI18n();
  const ws = useWorkspace();
  const query = useData<Game[]>('games');
  const action = useAction();
  useRealtime(['game_sessions', 'game_answers']);
  const active = (query.data || []).filter((g) => !g.closed);
  const history = (query.data || []).filter((g) => g.closed);
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PLAY, A LITTLE CLOSER"
        title={t('هنوز چیزهایی برای کشف‌کردن هست.', 'There’s always more of you to discover.')}
        description={t(
          'نه برنده‌ای، نه بازنده‌ای. فقط دو نفر، کمی نزدیک‌تر.',
          'No winners. No losers. Just two people, a little closer.',
        )}
      />
      <SetupNotice />
      <MembershipNotice />
      <div className="game-grid">
        {gameTypes.map((game, index) => (
          <article className="game-card" key={game.id}>
            <span className="game-no" dir="ltr" aria-hidden="true">
              0{index + 1}
            </span>
            <div className="game-icon">
              <game.icon size={29} strokeWidth={1.2} />
            </div>
            <h2>{t(game.fa, game.en)}</h2>
            <p>{t(game.bodyFa, game.bodyEn)}</p>
            <Button
              variant="secondary"
              busy={action.pending}
              disabled={!ws.configured || !ws.couple}
              onClick={async () => {
                await action.run({ type: 'game.start', kind: game.id });
                document
                  .getElementById('our-rounds')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <Sparkles size={14} />
              {t('با هم بازی کنیم', 'Let’s play together')}
            </Button>
          </article>
        ))}
      </div>
      <div id="our-rounds">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : active.length ? (
          active.map((game) => <Round key={game.id} game={game} />)
        ) : (
          <section className="panel">
            <EmptyState
              compact
              icon={Sparkles}
              title={t('یک بازی کوچک، یک کشف تازه.', 'A little game. A new discovery.')}
              description={t(
                'یکی از بازی‌ها را انتخاب کن؛ دور و جواب‌هایتان به‌صورت خصوصی ذخیره می‌شوند.',
                'Choose a game above. Your rounds and answers are saved privately.',
              )}
            />
          </section>
        )}
      </div>
      {history.length > 0 && (
        <details className="panel" style={{ marginTop: 24 }}>
          <summary>
            {t('دورهای قبلی ما', 'Our previous rounds')} ({history.length})
          </summary>
          <div style={{ marginTop: 20 }}>
            {history.map((game) => (
              <Round key={game.id} game={game} history />
            ))}
          </div>
        </details>
      )}
      <div className="privacy-explainer">
        <LockKeyhole size={17} />
        <p>
          {t(
            'جواب‌ها تا زمان مجاز از پایگاه داده مخفی می‌مانند. هر نفر در هر دور یک پاسخ ثبت می‌کند. سؤال روز در نیمه‌شب UTC تازه می‌شود و به رضایت مستقل هر دو نفر نیاز دارد.',
            'Answers remain hidden in the database until the rules allow reveal. Each person submits once per round. Question of the Day resets at midnight UTC and requires both people’s independent consent.',
          )}
        </p>
      </div>
    </>
  );
}
