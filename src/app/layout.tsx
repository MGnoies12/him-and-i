import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { getWorkspace } from '@/lib/server/workspace';
export const metadata: Metadata = {
  title: { default: 'HIM & I — دنیایی فقط برای ما', template: '%s · HIM & I' },
  description:
    'A private little world for two. Memories, conversations, letters, and moments that belong to you.',
  applicationName: 'HIM & I',
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF8F2',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  const cookie = (await cookies()).get('hi-locale')?.value;
  const locale =
    cookie === 'en' || cookie === 'fa' ? cookie : workspace.profile?.locale === 'en' ? 'en' : 'fa';
  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'} data-scroll-behavior="smooth">
      <body>
        <Providers locale={locale} workspace={workspace}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
