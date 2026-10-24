'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Heart,
  CalendarDays,
  Sparkles,
  Plus,
  Camera,
  ArrowUpRight,
  LockKeyhole,
  Plane,
  Feather,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import { useData, useRealtime } from '@/hooks/use-data';
import {
  SetupNotice,
  LinkButton,
  SectionHeading,
  EmptyState,
  DirectionArrow,
  ErrorState,
  LoadingState,
} from '@/components/ui/primitives';
import { PrivateMedia } from '@/components/ui/media';
import { Onboarding } from './onboarding';
import { MemoryCard } from './memories';
import type { Memory, Event, Message } from '@/types/models';
import type { Row } from '@/types/database';
import { formatDate, formatTime, relationshipDays } from '@/lib/dates';
import { moods } from '@/lib/moods';
interface HomeData {
  memories: Memory[];
  events: Event[];
  moods: Row<'daily_moods'>[];
  messages: Message[];
  notifications: Row<'notifications'>[];
  counts: { memories: number; unread: number; letters: number };
}
export function HomeScreen() {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const query = useData<HomeData>('home');
  useRealtime(['messages', 'memories', 'conversation_reads']);
  const partner = ws.members.find((p) => p.id !== ws.userId);
  const data = query.data;
  const featured = data?.memories[0];
  const cover = featured?.memory_media[0]?.upload_assets;
  const partnerMood = data?.moods.find((m) => m.owner_id === partner?.id);
  const mood = moods.find((m) => m.id === partnerMood?.mood);
  return (
    <>
      <div className="home-greeting">
        <div>
          <div className="eyebrow" dir="ltr">
            A LITTLE WORLD, JUST FOR US
          </div>
          <h1>
            {ws.profile?.display_name
              ? t(
                  `سلام ${ws.profile.display_name}، به خانه خوش آمدی.`,
                  `Hello ${ws.profile.display_name}, you’re home.`,
                )
              : t('به دنیای کوچکمان خوش آمدی.', 'Welcome to our little world.')}
          </h1>
          <p>
            {t(
              'جایی برای تمام چیزهایی که «ما» را می‌سازند.',
              'A place for all the little things that make us, us.',
            )}
          </p>
        </div>
        <span className="date-pill">
          <CalendarDays size={14} />
          {formatDate(new Date(), locale, timezone, { weekday: 'long', year: undefined })}
        </span>
      </div>
      <SetupNotice />
      <Onboarding />
      {query.isError && <ErrorState error={query.error} retry={() => void query.refetch()} />}{' '}
      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <motion.div
            className="home-top"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <section className="story-hero">
              <Sparkles className="hero-sparkle" size={26} strokeWidth={1.1} />
              <div className="hero-copy">
                <div className="eyebrow" dir="ltr">
                  {featured ? 'A MOMENT TO KEEP' : 'THE BEAUTY OF US'}
                </div>
                <h2 className="hero-title">
                  {featured ? (
                    featured.title
                  ) : (
                    <>
                      {t('کنار تو،', 'With you,')}
                      <br />
                      <span className="romantic-accent">
                        {t('معمولی هم قشنگ است.', 'ordinary is beautiful.')}
                      </span>
                    </>
                  )}
                </h2>
                <p className="hero-description">
                  {featured
                    ? formatDate(featured.memory_date, locale, 'UTC')
                    : t(
                        'یک فنجان چای، یک لبخند بی‌هوا، یک روز ساده. قصه‌ی ما از همین لحظه‌ها ساخته می‌شود.',
                        'A cup of coffee. An unexpected smile. A slow afternoon. Our story is made of moments like these.',
                      )}
                </p>
                <LinkButton href={featured ? `/memories/${featured.id}` : '/memories/new'}>
                  {featured
                    ? t('برگشتن به این لحظه', 'Revisit this moment')
                    : t('اولین خاطره‌مان', 'Our first memory')}
                  <DirectionArrow size={15} />
                </LinkButton>
              </div>
              <div className="hero-photo">
                <span className="paper-tape" />
                {cover ? (
                  <PrivateMedia asset={cover} alt={featured?.title} className="hero-image" />
                ) : (
                  <img
                    src="/images/together.jpg"
                    alt={t(
                      'تصویر تزئینی گل و دو فنجان؛ خاطره‌ی شخصی نیست',
                      'Decorative roses and two cups; not a personal memory',
                    )}
                  />
                )}
                <span className="polaroid-caption" dir="ltr">
                  little moments, big love <Heart size={16} />
                </span>
                {!cover && (
                  <div className="hero-photo-label">
                    {t('تصویر الهام‌بخش', 'decorative brand image')}
                  </div>
                )}
              </div>
            </section>
            <section className="mood-card">
              <div className="panel-header">
                <h2>{t('امروز، دلت چه رنگی‌ست؟', 'How’s your heart today?')}</h2>
                <Heart size={18} strokeWidth={1.4} />
              </div>
              <p>
                {t('یک مکث کوچک، برای حالِ خودت.', 'A little pause to check in with yourself.')}
              </p>
              <div className="mood-options-mini">
                {moods.slice(0, 4).map((item) => (
                  <Link className="mood-mini" href={`/mood?select=${item.id}`} key={item.id}>
                    <span>
                      <item.icon size={22} strokeWidth={1.4} />
                    </span>
                    <span>{t(item.fa, item.en)}</span>
                  </Link>
                ))}
              </div>
              <div className="mood-card-bottom">
                {partnerMood && mood ? (
                  <>
                    <span className="avatar partner">
                      {partner?.display_name.slice(0, 1) || <UserRound size={12} />}
                    </span>
                    <span>
                      {partner?.display_name} · {t(mood.fa, mood.en)}
                    </span>
                  </>
                ) : (
                  <>
                    <LockKeyhole size={12} />
                    <span>
                      {t(
                        'فقط وقتی بخواهی، با همراهت شریک می‌شود.',
                        'Only shared with your partner when you choose.',
                      )}
                    </span>
                  </>
                )}
              </div>
            </section>
          </motion.div>
          <section className="relationship-strip">
            <div className="avatar-group">
              <span className="avatar">
                {ws.profile?.display_name.slice(0, 1) || <UserRound size={19} />}
              </span>
              <span className="heart-connector">
                <Heart size={11} />
              </span>
              <span className={`avatar ${partner ? 'partner' : 'dashed'}`}>
                {partner?.display_name.slice(0, 1) || <Plus size={17} />}
              </span>
            </div>
            <div className="relationship-copy">
              <h3>
                {partner
                  ? `${ws.profile?.display_name} ${t('و', '&')} ${partner.display_name}`
                  : t('تو، من و تمام روزهای پیش رو', 'You, me, and all the days ahead')}
              </h3>
              <p>
                {ws.couple?.relationship_start
                  ? `${t('از', 'Since')} ${formatDate(ws.couple.relationship_start, locale, 'UTC')}`
                  : t('هر قصه‌ای، یک روز شروع می‌شود.', 'Every story begins somewhere.')}
              </p>
            </div>
            {ws.couple?.relationship_start ? (
              <div className="relationship-count">
                <strong>
                  {new Intl.NumberFormat(locale).format(
                    relationshipDays(ws.couple.relationship_start, timezone),
                  )}
                </strong>
                <small>{t('روز کنار هم', 'days together')}</small>
              </div>
            ) : (
              <Link href="/settings" className="text-link">
                {t('روز شروع ما', 'Our beginning')}
                <Plus size={13} />
              </Link>
            )}
          </section>
          <div className="quick-actions">
            {[
              {
                href: '/memories/new',
                icon: Camera,
                fa: 'ثبت یک خاطره',
                en: 'Keep a memory',
                bodyFa: 'این لحظه را نگه داریم',
                bodyEn: 'Make this moment last',
              },
              {
                href: '/letters?compose=1',
                icon: Feather,
                fa: 'یک نامه برای تو',
                en: 'Write a little letter',
                bodyFa: 'حرف‌هایی از دل',
                bodyEn: 'A few words from the heart',
              },
              {
                href: '/calendar?new=1',
                icon: CalendarDays,
                fa: 'قرار بعدی ما',
                en: 'Plan our next date',
                bodyFa: 'یک دلیل برای انتظار',
                bodyEn: 'Something to look forward to',
              },
            ].map((item) => (
              <Link className="quick-action" href={item.href} key={item.href}>
                <div className="quick-icon">
                  <item.icon size={19} strokeWidth={1.5} />
                </div>
                <div>
                  <h3>{t(item.fa, item.en)}</h3>
                  <p>{t(item.bodyFa, item.bodyEn)}</p>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          <SectionHeading
            title={t('تکه‌هایی از قصه‌ی ما', 'Little pieces of our story')}
            href="/memories"
            linkLabel={t('آلبوم خاطره‌ها', 'Our memory book')}
          />
          {data?.memories.length ? (
            <div className="memory-grid">
              {data.memories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          ) : (
            <div className="empty-memory-row">
              {[
                {
                  icon: Camera,
                  fa: 'اولین قابِ ما',
                  en: 'Our first little frame',
                  descFa: 'یک عکس، شروع یک قصه.',
                  descEn: 'One photo. The start of a story.',
                },
                {
                  icon: Plane,
                  fa: 'یک جای تازه، کنار هم',
                  en: 'Somewhere new, together',
                  descFa: 'سفرهای کوچک هم ارزش نگه‌داشتن دارند.',
                  descEn: 'Even the smallest adventures belong here.',
                },
                {
                  icon: Heart,
                  fa: 'همین لحظه‌های ساده',
                  en: 'The beautifully ordinary',
                  descFa: 'هنوز خاطره‌ای نداریم؛ از امروز شروع کنیم؟',
                  descEn: 'No memories yet. Shall we start with today?',
                },
              ].map((item) => (
                <Link href="/memories/new" className="empty-memory" key={item.en}>
                  <item.icon size={28} strokeWidth={1.1} />
                  <h3>{t(item.fa, item.en)}</h3>
                  <p>{t(item.descFa, item.descEn)}</p>
                </Link>
              ))}
            </div>
          )}
          <div className="home-bottom">
            <section className="panel">
              <div className="panel-header">
                <h2>{t('چیزی برای چشم‌به‌راه بودن', 'Something to look forward to')}</h2>
                <CalendarDays size={19} strokeWidth={1.4} />
              </div>
              {data?.events.length ? (
                data.events.map((event) => (
                  <Link className="event-preview" href="/calendar" key={event.id}>
                    <div className="event-date">
                      <strong>
                        {formatDate(event.starts_at, locale, event.timezone, {
                          day: 'numeric',
                          month: undefined,
                          year: undefined,
                        })}
                      </strong>
                      <span>
                        {formatDate(event.starts_at, locale, event.timezone, {
                          month: 'short',
                          day: undefined,
                          year: undefined,
                        })}
                      </span>
                    </div>
                    <div>
                      <h3>{event.title}</h3>
                      <p>
                        {formatDate(event.starts_at, locale, event.timezone, {
                          weekday: 'long',
                          day: undefined,
                          month: undefined,
                          year: undefined,
                        })}{' '}
                        ·{' '}
                        {event.all_day
                          ? t('تمام روز', 'All day')
                          : formatTime(event.starts_at, locale, event.timezone)}
                      </p>
                    </div>
                    <DirectionArrow size={16} />
                  </Link>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={CalendarDays}
                  title={t('تقویم‌مان منتظر یک قرار است', 'Our calendar is waiting for a date')}
                  description={t(
                    'از یک پیاده‌روی ساده تا یک روز خیلی خاص.',
                    'From a simple walk to a very special day.',
                  )}
                  action={
                    <Link href="/calendar?new=1" className="text-link">
                      <Plus size={14} />
                      {t('یک قرار بسازیم', 'Let’s make a plan')}
                    </Link>
                  }
                />
              )}
            </section>
            <section className="letter-teaser">
              <div>
                <div className="eyebrow" dir="ltr">
                  WORDS FROM THE HEART
                </div>
                <h2>
                  {t('بعضی حرف‌ها،', 'Some things')}
                  <br />
                  {t('به یک نامه نیاز دارند.', 'deserve a letter.')}
                </h2>
                <p>
                  {data?.counts.letters
                    ? t(
                        `${data.counts.letters} نامه‌ی بازنشده در انتظار شماست.`,
                        `${data.counts.letters} unopened letters are waiting for you.`,
                      )
                    : t(
                        'برای همین حالا، یا روزی که هنوز نرسیده. کلماتت را به دست زمان بسپار.',
                        'For right now, or for a day still to come. Give your words a little time.',
                      )}
                </p>
                <LinkButton href="/letters" variant="ghost">
                  {t('به صندوق نامه‌ها', 'To our letterbox')}
                  <DirectionArrow size={15} />
                </LinkButton>
              </div>
              <div className="envelope-art" aria-hidden="true">
                <Heart />
              </div>
            </section>
          </div>
          <SectionHeading
            title={t('آخرین حرف‌های دونفره', 'Our latest little conversations')}
            href="/chat"
          />
          {data?.messages.length ? (
            <section className="panel">
              {data.messages.map((message) => (
                <Link className="event-preview" href="/chat" key={message.id}>
                  <span className="avatar small">
                    {ws.members
                      .find((p) => p.id === message.sender_id)
                      ?.display_name.slice(0, 1) || <UserRound size={16} />}
                  </span>
                  <div>
                    <h3>
                      {message.body.slice(0, 120) || t('یک فایل خصوصی', 'A private attachment')}
                    </h3>
                    <p>{formatTime(message.created_at, locale, timezone)}</p>
                  </div>
                  <MessageCircle size={16} />
                </Link>
              ))}
            </section>
          ) : (
            <section className="panel">
              <div className="inline-note">
                <MessageCircle size={17} />
                <span>
                  {t(
                    'هنوز پیامی نیست. گاهی یک «سلام» ساده، تمام چیزی‌ست که لازم داریم.',
                    'No messages yet. Sometimes a simple “hello” is all it takes.',
                  )}
                </span>
                <Link href="/chat" className="text-link" style={{ marginInlineStart: 'auto' }}>
                  {t('گفت‌وگو', 'Say hello')}
                  <DirectionArrow size={14} />
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
