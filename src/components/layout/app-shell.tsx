'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import {
  House,
  Images,
  MessageCircle,
  Mail,
  CalendarDays,
  Heart,
  Music2,
  Sparkles,
  Flower2,
  Bell,
  Settings,
  LockKeyhole,
  Search,
  Globe2,
  UserRound,
  ArrowUpRight,
  WifiOff,
  Menu,
  X,
  BookHeart,
} from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import { Modal, Button, ErrorState } from '@/components/ui/primitives';
import { useData, useRealtime } from '@/hooks/use-data';
import { formatDate } from '@/lib/dates';
import { NativeBridge } from './native-bridge';
export const navItems = [
  { href: '/home', fa: 'خانه‌ی ما', en: 'Our home', icon: House },
  { href: '/memories', fa: 'خاطره‌ها', en: 'Memories', icon: Images },
  { href: '/chat', fa: 'گفت‌وگوی ما', en: 'Our conversation', icon: MessageCircle },
  { href: '/letters', fa: 'نامه‌های عاشقانه', en: 'Love letters', icon: Mail },
  { href: '/calendar', fa: 'تقویم دونفره', en: 'Our calendar', icon: CalendarDays },
  { href: '/mood', fa: 'حال‌وهوای ما', en: 'Daily check-in', icon: Heart },
  { href: '/music', fa: 'آهنگ‌های ما', en: 'Our soundtrack', icon: Music2 },
  { href: '/games', fa: 'کمی نزدیک‌تر', en: 'A little closer', icon: Sparkles },
  { href: '/cycle', fa: 'مراقبت از خودم', en: 'My wellbeing', icon: Flower2 },
];
export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <Link href="/home" className={`wordmark ${small ? 'small' : ''}`}>
      <span dir="ltr">
        HIM <i>&</i> I
      </span>
      <span className="brand-subline" dir="ltr">
        a little world, just for us
      </span>
    </Link>
  );
}
function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale, timezone } = useI18n();
  const ws = useWorkspace();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const home = useData<{ counts: { unread: number; letters: number }; notifications: unknown[] }>(
    'home',
  );
  useRealtime(['notifications']);
  const active = navItems.find((item) => path === item.href || path.startsWith(item.href + '/'));
  const unread = home.data?.counts.unread || 0;
  function Navigation() {
    return (
      <>
        <div className="nav-label">{t('دنیای دونفره‌ی ما', 'OUR LITTLE WORLD')}</div>
        <nav aria-label={t('ناوبری اصلی', 'Main navigation')}>
          {navItems.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className={`nav-link ${path === item.href || path.startsWith(item.href + '/') ? 'active' : ''}`}
              aria-current={path === item.href ? 'page' : undefined}
              onClick={() => setMenu(false)}
            >
              <item.icon size={20} strokeWidth={1.6} />
              <span>{t(item.fa, item.en)}</span>
              {item.href === '/chat' && unread > 0 ? (
                <span className="nav-count">{unread}</span>
              ) : item.href === '/cycle' ? (
                <LockKeyhole className="nav-lock" size={12} />
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <nav aria-label={t('حساب کاربری', 'Your account')}>
          <Link
            href="/notifications"
            className={`nav-link ${path === '/notifications' ? 'active' : ''}`}
            onClick={() => setMenu(false)}
          >
            <Bell size={20} strokeWidth={1.6} />
            <span>{t('اعلان‌ها', 'Notifications')}</span>
            {!!home.data?.notifications.length && <span className="notification-dot" />}
          </Link>
          <Link
            href="/settings"
            className={`nav-link ${path === '/settings' ? 'active' : ''}`}
            onClick={() => setMenu(false)}
          >
            <Settings size={20} strokeWidth={1.6} />
            <span>{t('تنظیمات', 'Settings')}</span>
          </Link>
        </nav>
      </>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('رفتن به محتوای اصلی', 'Skip to content')}
      </a>
      <NativeBridge />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wordmark />
          <div className="brand-flourish">
            <span />
            <Heart size={12} />
            <span />
          </div>
        </div>
        <Navigation />
        <div className="sidebar-note">
          <BookHeart size={23} strokeWidth={1.4} />
          <p>
            {t(
              'بعضی قصه‌ها، فقط برای دو نفر نوشته می‌شوند.',
              'Some stories are only meant for two.',
            )}
          </p>
          <span className="handwritten" dir="ltr">
            yours, always.
          </span>
        </div>
        <Link href="/privacy" className="sidebar-privacy">
          <LockKeyhole size={13} />
          {t('خصوصی، با انتخاب شما', 'Private, by your choice')}
        </Link>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-context">
            <span className="context-icon">
              <Heart size={17} />
            </span>
            <span>{t('فضای کوچک ما', 'Our little space')}</span>
            <span className="topbar-divider">/</span>
            <strong>
              {active
                ? t(active.fa, active.en)
                : path === '/settings'
                  ? t('تنظیمات', 'Settings')
                  : t('اعلان‌ها', 'Notifications')}
            </strong>
          </div>
          <div className="topbar-tools">
            <form action="/memories" className="global-search">
              <Search size={17} />
              <input
                name="q"
                placeholder={t('در خاطره‌ها جست‌وجو کن…', 'Find a little memory…')}
                aria-label={t('جست‌وجو در خاطره‌ها', 'Search memories')}
              />
              <kbd>⌕</kbd>
            </form>
            <button
              className="icon-button locale-button"
              onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
              aria-label={locale === 'fa' ? 'EN · Switch to English' : 'فا · تغییر زبان به فارسی'}
            >
              <Globe2 size={18} />
              <span>{locale === 'fa' ? 'EN' : 'فا'}</span>
            </button>
            <Link
              href="/notifications"
              className="icon-button bell-button"
              aria-label={t('اعلان‌ها', 'Notifications')}
            >
              <Bell size={19} />
              {!!home.data?.notifications.length && <span className="notification-dot" />}
            </Link>
            <Link href="/settings" className="avatar small" aria-label={t('حساب من', 'My profile')}>
              {ws.profile?.display_name?.slice(0, 1) || <UserRound size={18} />}
            </Link>
          </div>
        </header>
        {!online && (
          <div className="offline-bar" role="status">
            <WifiOff size={16} />
            {t(
              'آفلاین هستید. اطلاعات قبلی ممکن است نمایش داده شود؛ تغییرات فقط با اتصال ذخیره می‌شوند.',
              'You’re offline. Previously loaded data may be visible; changes require a connection.',
            )}
          </div>
        )}
        <main id="main-content" className="main-content">
          {ws.error ? (
            <ErrorState error={new Error('request_failed')} retry={() => location.reload()} />
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          <span>
            <Heart size={12} />
            {t(
              'برای تمام لحظه‌های معمولیِ دوست‌داشتنی',
              'For all the beautifully ordinary moments',
            )}
          </span>
          <span dir="ltr">
            HIM & I <span className="footer-dot">·</span>{' '}
            {formatDate(new Date(), locale, timezone, {
              year: 'numeric',
              month: undefined,
              day: undefined,
            })}
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label={t('ناوبری موبایل', 'Mobile navigation')}>
        {[navItems[0], navItems[1], navItems[2], navItems[4]].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={path === item.href || path.startsWith(item.href + '/') ? 'active' : ''}
          >
            <item.icon size={21} strokeWidth={1.7} />
            <span>
              {item.href === '/chat'
                ? t('گفت‌وگو', 'Chat')
                : item.href === '/calendar'
                  ? t('تقویم', 'Calendar')
                  : t(item.fa, item.en)}
            </span>
          </Link>
        ))}
        <button onClick={() => setMenu(true)} aria-label={t('بخش‌های بیشتر', 'More sections')}>
          <Menu size={22} />
          <span>{t('بیشتر', 'More')}</span>
        </button>
      </nav>
      <Modal
        open={menu}
        onClose={() => setMenu(false)}
        title={t('دنیای کوچک ما', 'Our little world')}
      >
        <Navigation />
      </Modal>
    </div>
  );
}
export function PublicHeader() {
  const { t, locale, setLocale } = useI18n();
  return (
    <header className="public-header">
      <Wordmark />
      <nav>
        <Link href="/privacy" className="public-privacy">
          {t('حریم خصوصی', 'Our privacy promise')}
        </Link>
        <button
          className="icon-button locale-button"
          onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
          aria-label={locale === 'fa' ? 'EN · Switch to English' : 'فا · تغییر زبان به فارسی'}
        >
          <Globe2 size={17} />
          <span>{locale === 'fa' ? 'EN' : 'فا'}</span>
        </button>
        <Link href="/login" className="button secondary">
          {t('ورود به دنیای ما', 'Sign in')}
          <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
export function DismissibleNote({ children }: { children: React.ReactNode }) {
  const [closed, setClosed] = useState(false);
  const { t } = useI18n();
  return closed ? null : (
    <div className="notice">
      {children}
      <Button variant="ghost" onClick={() => setClosed(true)} aria-label={t('بستن', 'Dismiss')}>
        <X size={15} />
      </Button>
    </div>
  );
}
