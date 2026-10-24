import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ user: vi.fn(), perform: vi.fn() }));
vi.mock('@/lib/server/http', async (original) => ({
  ...(await original<typeof import('@/lib/server/http')>()),
  requireUser: mock.user,
}));
vi.mock('@/lib/server/actions', () => ({ performAction: mock.perform }));
import { POST } from '@/app/api/actions/route';
let sequence = 0;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://couple.example');
  mock.user.mockResolvedValue({ db: {}, user: { id: `synthetic-actor-${++sequence}` } });
  mock.perform.mockResolvedValue('synthetic-space');
});
afterEach(() => vi.unstubAllEnvs());
function post(body: unknown) {
  return POST(
    new Request('https://couple.example/api/actions', {
      method: 'POST',
      headers: { Origin: 'https://couple.example', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
describe('authenticated pairing HTTP boundary', () => {
  it('normalizes code input while ignoring any client-supplied account identity', async () => {
    const response = await post({
      type: 'invitation.code.accept',
      code: '۲abc-۳def ٤ghj',
      user_id: 'forged-actor',
    });
    expect(response.status).toBe(200);
    expect(mock.perform).toHaveBeenCalledWith(
      {},
      { id: `synthetic-actor-${sequence}` },
      { type: 'invitation.code.accept', code: '2ABC3DEF4GHJ' },
      'https://couple.example',
    );
  });
  it('rate-limits malformed attempts before validation, not only successful redemptions', async () => {
    for (let i = 0; i < 10; i++)
      expect((await post({ type: 'invitation.code.accept', code: 'wrong' })).status).toBe(422);
    const limited = await post({ type: 'invitation.code.accept', code: 'wrong' });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate_limited' });
    expect(mock.perform).not.toHaveBeenCalled();
  });
});
