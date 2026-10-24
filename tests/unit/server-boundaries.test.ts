import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  server: vi.fn(),
  workspace: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ serverSupabase: mock.server }));
vi.mock('@/lib/server/workspace', () => ({ getWorkspace: mock.workspace }));
vi.mock('next/navigation', () => ({
  redirect: mock.redirect,
  useRouter: () => ({}),
  usePathname: () => '/home',
}));
import { assertSameOrigin, requireUser, ApiError, failure, readJSONBody } from '@/lib/server/http';
import PrivateLayout from '@/app/(app)/layout';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://couple.example');
  mock.redirect.mockImplementation(() => {
    throw new Error('REDIRECT_LOGIN');
  });
});
describe('trusted server boundary', () => {
  it('refuses requests when Supabase is not configured', async () => {
    mock.server.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({
      code: 'configuration_required',
      status: 503,
    });
  });
  it('validates the user on the server instead of trusting session claims in request bodies', async () => {
    mock.server.mockResolvedValue({ auth: { getUser: mock.getUser } });
    mock.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid jwt') });
    await expect(requireUser()).rejects.toMatchObject({ code: 'unauthenticated', status: 401 });
    mock.getUser.mockResolvedValue({ data: { user: { id: 'verified-by-provider' } }, error: null });
    expect((await requireUser()).user.id).toBe('verified-by-provider');
    expect(mock.getUser).toHaveBeenCalledTimes(2);
  });
  it('blocks cross-origin and missing-Origin mutations', () => {
    expect(() =>
      assertSameOrigin(
        new Request('https://couple.example/api/actions', {
          method: 'POST',
          headers: { Origin: 'https://attacker.example' },
        }),
      ),
    ).toThrow(ApiError);
    expect(() =>
      assertSameOrigin(new Request('https://couple.example/api/actions', { method: 'POST' })),
    ).toThrow(ApiError);
    expect(() =>
      assertSameOrigin(
        new Request('https://couple.example/api/actions', {
          method: 'POST',
          headers: { Origin: 'https://couple.example' },
        }),
      ),
    ).not.toThrow();
  });
  it('does not return private provider error details', async () => {
    const response = failure(new Error('Private description, token, or signed media URL'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'request_failed' });
  });
  it('redirects unauthenticated visitors away from configured private routes', async () => {
    mock.workspace.mockResolvedValue({ configured: true, userId: null });
    await expect(PrivateLayout({ children: 'private' })).rejects.toThrow('REDIRECT_LOGIN');
    expect(mock.redirect).toHaveBeenCalledWith('/login');
  });
  it('allows an explicit data-free setup view, not an authentication bypass', async () => {
    mock.workspace.mockResolvedValue({ configured: false, userId: null });
    expect(await PrivateLayout({ children: 'setup' })).toBeTruthy();
    expect(mock.redirect).not.toHaveBeenCalled();
  });
  it('allows verified members to render the application shell', async () => {
    mock.workspace.mockResolvedValue({ configured: true, userId: 'verified' });
    expect(await PrivateLayout({ children: 'authorized' })).toBeTruthy();
    expect(mock.redirect).not.toHaveBeenCalled();
  });
  it('bounds streamed request bodies, even without Content-Length', async () => {
    const request = new Request('https://couple.example/api/actions', {
      method: 'POST',
      body: 'x'.repeat(100),
    });
    await expect(readJSONBody(request, 50)).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    });
  });
  it('returns a validation error for malformed JSON rather than leaking parser internals', async () => {
    await expect(
      readJSONBody(
        new Request('https://couple.example/api/actions', { method: 'POST', body: 'not-json' }),
      ),
    ).rejects.toMatchObject({ code: 'validation_failed', status: 422 });
  });
});
