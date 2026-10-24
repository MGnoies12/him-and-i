import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
const jwt = (role: string) => `${btoa('{}')}.${btoa(JSON.stringify({ role }))}.synthetic-signature`;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
});
afterEach(() => vi.unstubAllEnvs());
describe('prevent accidental secret publication at build/start, not just at runtime', () => {
  it('refuses a secret key in the public publishable-key variable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_synthetic');
    await expect(import('../../next.config')).rejects.toThrow(
      'Refusing unsafe public Supabase configuration',
    );
  });
  it('also refuses a hidden legacy service-role fallback even if the primary public key is valid', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', jwt('service_role'));
    await expect(import('../../next.config')).rejects.toThrow(
      'Refusing unsafe public Supabase configuration',
    );
  });
  it('refuses credential-bearing public origins', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic:password@example.supabase.co');
    await expect(import('../../next.config')).rejects.toThrow(
      'Public application URLs must never contain credentials',
    );
  });
  it('permits honest unconfigured setup mode and a legitimate public configuration', async () => {
    const setupConfig = (await import('../../next.config')).default;
    expect(setupConfig.logging).toEqual({ incomingRequests: false, fetches: { fullUrl: false } });
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic');
    expect((await import('../../next.config')).default).toBeDefined();
  });
});
