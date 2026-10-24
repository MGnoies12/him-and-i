import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  config: vi.fn(),
  admin: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  probe: vi.fn(),
}));
vi.mock('@/lib/config', () => ({ publicConfig: mock.config }));
vi.mock('@/lib/server/admin', () => ({ adminSupabase: mock.admin }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-not-a-real-key');
  mock.config.mockReturnValue({ configured: true });
  mock.admin.mockReturnValue({ from: mock.from });
  mock.from.mockReturnValue({ select: mock.select });
  mock.select.mockReturnValue({ limit: mock.limit });
  mock.limit.mockReturnValue({ abortSignal: mock.probe });
  mock.probe.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function health() {
  return (await import('@/app/api/health/route')).GET();
}
describe('public readiness endpoint, not an end-to-end service claim', () => {
  it('fails closed for missing public configuration or server credentials', async () => {
    mock.config.mockReturnValue(null);
    expect((await health()).status).toBe(503);
    expect(mock.admin).not.toHaveBeenCalled();
    mock.config.mockReturnValue({ configured: true });
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await health()).status).toBe(503);
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it('checks schema with zero returned rows and caches the probe, not the HTTP response', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true, mode: 'configured' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mock.from).toHaveBeenCalledWith('profile_preferences');
    expect(mock.limit).toHaveBeenCalledWith(0);
    expect(mock.probe).toHaveBeenCalledWith(expect.any(AbortSignal));
    await health();
    expect(mock.probe).toHaveBeenCalledTimes(1);
  });
  it('rechecks after 30 seconds and never exposes provider errors or secrets', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    await health();
    clock.mockReturnValue(32000);
    mock.probe.mockRejectedValue(new Error('PRIVATE PROVIDER DETAILS'));
    const response = await health();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ready: false, mode: 'setup-required' });
    expect(mock.probe).toHaveBeenCalledTimes(2);
  });
  it('rejects an unreachable or missing schema rather than reporting configured success', async () => {
    mock.probe.mockResolvedValue({ error: { message: 'private schema details' } });
    const response = await health();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ready: false, mode: 'setup-required' });
  });
});
