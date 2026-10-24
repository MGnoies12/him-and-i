import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  server: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  reset: vi.fn(),
  getUser: vi.fn(),
  update: vi.fn(),
  exchange: vi.fn(),
  verify: vi.fn(),
  personal: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ serverSupabase: mock.server }));
import { POST } from '@/app/api/auth/route';
import { GET as callback } from '@/app/auth/callback/route';
import { GET as confirm } from '@/app/auth/confirm/route';
let attempt = 0;
function post(body: unknown) {
  return POST(
    new Request('https://couple.example/api/auth', {
      method: 'POST',
      headers: { Origin: 'https://couple.example', 'X-Forwarded-For': `192.0.2.${++attempt}` },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://couple.example');
  mock.personal.mockResolvedValue({
    data: { onboarding_completed_at: '2026-01-01T00:00:00Z' },
    error: null,
  });
  mock.server.mockResolvedValue({
    from: () => ({ select: () => ({ maybeSingle: mock.personal }) }),
    auth: {
      signInWithPassword: mock.signIn,
      signUp: mock.signUp,
      resetPasswordForEmail: mock.reset,
      getUser: mock.getUser,
      updateUser: mock.update,
      exchangeCodeForSession: mock.exchange,
      verifyOtp: mock.verify,
    },
  });
});
describe('real auth handler boundaries with an isolated provider mock', () => {
  it('does not turn a successful sign-in into an open redirect', async () => {
    mock.signIn.mockResolvedValue({ error: null });
    const response = await post({
      type: 'login',
      email: 'fixture@example.com',
      password: ' private test pass ',
      next: 'https://attacker.example',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect: '/home' });
    expect(mock.signIn).toHaveBeenCalledWith({
      email: 'fixture@example.com',
      password: ' private test pass ',
    });
  });
  it('reports verification required instead of fabricating a logged-in session', async () => {
    mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const response = await post({
      type: 'signup',
      email: 'fixture@example.com',
      password: 'long synthetic passphrase',
      display_name: 'Synthetic person',
      next: '/invite/' + 'A'.repeat(43),
    });
    expect(await response.json()).toEqual({ message: 'check_email' });
    expect(mock.signUp.mock.calls[0][0].options.emailRedirectTo).toContain(
      'https://couple.example/auth/callback?next=',
    );
  });
  it('keeps password-reset responses account-enumeration neutral', async () => {
    mock.reset.mockResolvedValue({ error: null });
    const response = await post({ type: 'reset', email: 'fixture@example.com' });
    expect(await response.json()).toEqual({ message: 'reset_email' });
    expect(mock.reset).toHaveBeenCalledWith('fixture@example.com', {
      redirectTo: 'https://couple.example/auth/callback?next=/update-password',
    });
  });
  it('requires a verified server session before changing a password', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    const response = await post({ type: 'password', password: 'long synthetic passphrase' });
    expect(response.status).toBe(401);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('preserves provider throttling without leaking provider details', async () => {
    mock.signIn.mockResolvedValue({ error: { status: 429, message: 'private provider detail' } });
    const response = await post({
      type: 'login',
      email: 'fixture@example.com',
      password: 'synthetic',
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
  });
  it('exchanges PKCE codes only through the auth provider and keeps redirects local', async () => {
    mock.exchange.mockResolvedValue({ error: null });
    const response = await callback(
      new Request(
        'https://couple.example/auth/callback?code=synthetic&next=https://attacker.example',
      ),
    );
    expect(mock.exchange).toHaveBeenCalledWith('synthetic');
    expect(response.headers.get('location')).toBe('https://couple.example/home');
  });
  it('supports single-use recovery token-hash templates for a different browser', async () => {
    mock.verify.mockResolvedValue({ error: null });
    const response = await confirm(
      new Request('https://couple.example/auth/confirm?token_hash=synthetic&type=recovery'),
    );
    expect(mock.verify).toHaveBeenCalledWith({ token_hash: 'synthetic', type: 'recovery' });
    expect(response.headers.get('location')).toBe('https://couple.example/update-password');
  });
  it('fails closed on an expired/reused confirmation token', async () => {
    mock.verify.mockResolvedValue({ error: { message: 'Expired synthetic token' } });
    const response = await confirm(
      new Request('https://couple.example/auth/confirm?token_hash=synthetic&type=email'),
    );
    expect(response.headers.get('location')).toBe(
      'https://couple.example/login?error=auth_callback',
    );
  });
});

describe('private onboarding after real authentication', () => {
  it('sends a newly authenticated person to preferences while retaining their invitation destination', async () => {
    mock.signIn.mockResolvedValue({ error: null });
    mock.personal.mockResolvedValue({ data: { onboarding_completed_at: null }, error: null });
    const next = '/invite/' + 'A'.repeat(43);
    const response = await post({
      type: 'login',
      email: 'fixture@example.com',
      password: 'synthetic passphrase',
      next,
    });
    expect(await response.json()).toEqual({
      redirect: '/onboarding?next=' + encodeURIComponent(next),
    });
  });
  it('sends only the name and optional gender to Auth, never period dates', async () => {
    mock.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    const response = await post({
      type: 'signup',
      email: 'fixture@example.com',
      password: 'synthetic long passphrase',
      display_name: 'Synthetic person',
      gender: 'female',
      period_start: '2026-06-01',
      reported_length: 29,
    });
    expect(response.status).toBe(200);
    expect(mock.signUp.mock.calls[0][0].options.data).toEqual({
      display_name: 'Synthetic person',
      gender: 'female',
    });
    expect((await response.json()).redirect).toMatch(/^\/onboarding\?/);
  });
});
