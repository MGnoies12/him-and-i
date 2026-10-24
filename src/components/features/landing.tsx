'use client';
import { motion } from 'motion/react';
import {
  Heart,
  LockKeyhole,
  ArrowUpRight,
  Feather,
  Images,
  MessageCircle,
  Flower2,
  Star,
  Sparkles,
} from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import { PublicHeader } from '@/components/layout/app-shell';
import { LinkButton, DirectionArrow } from '@/components/ui/primitives';
import Link from 'next/link';
export function Landing() {
  const { t } = useI18n();
  const ws = useWorkspace();
  return (
    <div className="landing-page">
      <PublicHeader />
      <main>
        <section className="landing-hero">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="landing-copy"
          >
            <div className="eyebrow">
              <span className="tiny-line" />
              {t('یک دنیا، برای دو نفر', 'ONE LITTLE WORLD. TWO PEOPLE.')}
            </div>
            <h1>
              {t('بعضی لحظه‌ها،', 'Some moments')}
              <br />
              {t('فقط مالِ', 'are just')}{' '}
              <span className="romantic-accent">{t('ما هستند.', 'ours.')}</span>
              <svg className="underline-swoosh" viewBox="0 0 270 24" aria-hidden="true">
                <path d="M4 15 Q130 -8 265 14 M20 22 Q130 6 233 18" />
              </svg>
            </h1>
            <p className="landing-description">
              {t(
                'خانه‌ای کوچک برای دوست‌داشتن‌های بزرگ. خاطره‌ها، حرف‌های نگفته و تمام چیزهای قشنگی که دنیای دونفره‌تان را می‌سازند.',
                'A little home for a love that feels big. Keep your memories, your unsaid words, and all the beautiful, ordinary things that make you, you.',
              )}
            </p>
            <div className="landing-actions">
              <LinkButton href="/signup">
                {t('قصه‌مان را شروع کنیم', 'Start our story')}
                <DirectionArrow />
              </LinkButton>
              <LinkButton href="/home" variant="ghost">
                {ws.configured
                  ? t('رفتن به خانه‌ی ما', 'Go to our home')
                  : t('نگاهی به فضای ما', 'Explore the space')}
                <ArrowUpRight size={17} />
              </LinkButton>
            </div>
            <div className="privacy-line">
              <span className="mini-circles">
                <Heart size={16} />
                <LockKeyhole size={15} />
              </span>
              <span>
                {t(
                  'فقط شما دو نفر. بدون دنبال‌کننده، بدون شلوغی.',
                  'Just you two. No followers. No noise.',
                )}
              </span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, rotate: 1 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="landing-art"
          >
            <div className="art-orbit" />
            <span className="art-star one">
              <Sparkles size={33} strokeWidth={1} />
            </span>
            <span className="art-star two">
              <Star size={19} strokeWidth={1} />
            </span>
            <div className="landing-polaroid">
              <div className="paper-tape" />
              <img
                src="/images/together.jpg"
                alt={t(
                  'تصویر تزئینی: دو فنجان و دو شاخه گل روی میز آفتاب‌گیر',
                  'Decorative still life: two cups and two roses in the afternoon light',
                )}
                fetchPriority="high"
              />
              <div className="polaroid-caption" dir="ltr">
                the best things are us. <Heart size={19} />
              </div>
            </div>
            <div className="floating-note">
              <Feather size={21} strokeWidth={1.2} />
              <span>{t('برای تو، همیشه.', 'For you, always.')}</span>
              <span className="handwritten" dir="ltr">
                a place to keep us
              </span>
            </div>
            <div className="art-caption">
              {t(
                'یک حس، نه یک خاطره‌ی ثبت‌شده · تصویر الهام‌بخش',
                'A feeling, not a saved memory · brand imagery',
              )}
            </div>
          </motion.div>
        </section>
        <div className="landing-divider">
          <span />
          <Heart size={15} strokeWidth={1.3} />
          <p>
            {t('همه‌ی چیزهای کوچک، در یک جای مخصوص', 'ALL THE LITTLE THINGS, IN ONE SPECIAL PLACE')}
          </p>
          <Heart size={15} strokeWidth={1.3} />
          <span />
        </div>
        <section className="landing-features">
          {[
            {
              icon: Images,
              fa: 'لحظه‌ها، ماندگار',
              en: 'Moments, kept close',
              bodyFa: 'یک آلبوم خصوصی از چیزهایی که نمی‌خواهید فراموش شوند.',
              bodyEn: 'A private scrapbook of the things you never want to forget.',
            },
            {
              icon: MessageCircle,
              fa: 'حرف‌هایی فقط برای ما',
              en: 'Words, just for us',
              bodyFa: 'از یک سلام ساده تا نامه‌ای برای روزی خاص.',
              bodyEn: 'From a simple hello to a letter saved for a special day.',
            },
            {
              icon: Flower2,
              fa: 'نزدیک، با احترام',
              en: 'Close, with care',
              bodyFa: 'حال‌وهوایتان را شریک شوید؛ حریم خودتان را نگه دارید.',
              bodyEn: 'Share how you feel, while keeping your own space.',
            },
          ].map((item) => (
            <article key={item.en}>
              <div className="feature-icon">
                <item.icon size={25} strokeWidth={1.4} />
              </div>
              <h2>{t(item.fa, item.en)}</h2>
              <p>{t(item.bodyFa, item.bodyEn)}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="landing-footer">
        <span dir="ltr">Made for your kind of love.</span>
        <Link href="/privacy">
          <LockKeyhole size={13} />
          {t('حریم خصوصی و امنیت', 'Privacy & security')}
        </Link>
        <span dir="ltr">HIM & I © {new Date().getUTCFullYear()}</span>
      </footer>
    </div>
  );
}
