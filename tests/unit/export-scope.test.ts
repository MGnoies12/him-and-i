import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('@/lib/server/http', async (original) => ({
  ...(await original<typeof import('@/lib/server/http')>()),
  requireUser: mock.user,
}));
import { GET } from '@/app/api/export/route';
const fixture: Record<string, Record<string, unknown>> = {
  profile_preferences: {
    owner_id: 'synthetic',
    gender: 'female',
    layout: 'auto',
    cycle_tracking: true,
    onboarding_completed_at: '2026-01-01T00:00:00Z',
  },
  notification_preferences: {
    owner_id: 'synthetic',
    chat: true,
    letters: true,
    events: false,
    memories: false,
    cycle: true,
    push_enabled: false,
  },
  period_records: { id: 'synthetic-record', owner_id: 'synthetic', start_date: '2026-06-01' },
};
function from(table: string) {
  let columns = '*';
  const query = {
    select: (value: string) => {
      columns = value;
      return query;
    },
    order: () => query,
    neq: () => query,
    range: async (offset: number) => ({
      error: null,
      data:
        offset || !fixture[table]
          ? []
          : [
              columns === '*'
                ? fixture[table]
                : Object.fromEntries(columns.split(',').map((key) => [key, fixture[table][key]])),
            ],
    }),
  };
  return query;
}
mock.user.mockResolvedValue({ db: { from }, user: { id: 'synthetic' } });
describe('separate account and private-health export scopes', () => {
  it('keeps all health records and tracking/reminder consent flags out of account exports', async () => {
    const response = await GET(new Request('https://synthetic.example/api/export?scope=account'));
    const data = await response.json();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(data).not.toHaveProperty('period_records');
    expect(data.profile_preferences[0]).not.toHaveProperty('cycle_tracking');
    expect(data.profile_preferences[0].gender).toBe('female');
    expect(data.notification_preferences[0]).not.toHaveProperty('cycle');
  });
  it('includes health consent with health records only in the explicit owner-private export', async () => {
    const response = await GET(new Request('https://synthetic.example/api/export?scope=cycle'));
    const data = await response.json();
    expect(data.scope).toBe('private-cycle');
    expect(data.profile_preferences).toEqual([{ owner_id: 'synthetic', cycle_tracking: true }]);
    expect(data.notification_preferences).toEqual([{ owner_id: 'synthetic', cycle: true }]);
    expect(data.period_records).toHaveLength(1);
  });
});
