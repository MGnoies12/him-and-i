export interface PublicConfig {
  url: string;
  key: string;
}
export function parsePublicConfig(env: { url?: string; key?: string }): PublicConfig | null {
  if (!env.url || !env.key) return null;
  try {
    const url = new URL(env.url);
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return null;
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', 'kong'].includes(url.hostname))
      return null;
    if (env.key.startsWith('sb_secret_')) return null;
    // Legacy service-role JWTs must never become browser credentials.
    if (env.key.split('.').length === 3) {
      const payload = JSON.parse(
        atob(env.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      ) as { role?: string };
      if (payload.role !== 'anon') return null;
    } else if (!env.key.startsWith('sb_publishable_')) return null;
    return { url: url.origin, key: env.key };
  } catch {
    return null;
  }
}
export function publicConfig() {
  return parsePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
export function safeRedirect(value: string | null | undefined, fallback = '/home'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value))
    return fallback;
  try {
    return new URL(value, 'https://him-and-i.invalid').origin === 'https://him-and-i.invalid'
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

export function safeExternalLink(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !/\s/.test(value) &&
      !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      ? url
      : null;
  } catch {
    return null;
  }
}
