import type { NextConfig } from 'next';
import { parsePublicConfig } from './src/lib/config';

// NEXT_PUBLIC values are compiled into browser JavaScript. Runtime rejection is too late:
// refuse the build/start itself before a misplaced server credential reaches a bundle.
for (const key of [
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
]) {
  if (key && !parsePublicConfig({ url: 'https://configuration-check.invalid', key })) {
    throw new Error(
      'Refusing unsafe public Supabase configuration. Only publishable/anon keys belong in NEXT_PUBLIC variables.',
    );
  }
}
for (const value of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_APP_URL]) {
  if (!value) continue;
  let url: URL | undefined;
  try {
    url = new URL(value);
  } catch {
    /* Incomplete configuration remains a setup state. */
  }
  if (url && (url.username || url.password))
    throw new Error('Public application URLs must never contain credentials.');
}

const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin;
  } catch {
    return '';
  }
})();
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" +
    (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace('https:', 'wss:').replace('http:', 'ws:')}`,
  "frame-ancestors 'self' https://*.arena.ai https://arena.ai https://*.e2b.app",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  // Invite/email links can contain single-use tokens. Never print request URLs in dev.
  logging: { incomingRequests: false, fetches: { fullUrl: false } },
  devIndicators: false,
  allowedDevOrigins: ['*.e2b.app'],
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/auth/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ];
  },
};
export default config;
