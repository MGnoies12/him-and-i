import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock('@/lib/server/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/http')>()),
  requireUser: mock.requireUser,
}));
import { GET } from '@/app/api/data/[resource]/route';
beforeEach(() => vi.clearAllMocks());
describe('memory favorite pagination query boundary (mocked provider)', () => {
  it.each([
    ['', '*,memory_media(*,upload_assets(*)),memory_favorites(*)'],
    ['1', '*,memory_media(*,upload_assets(*)),memory_favorites!inner(*)'],
  ])(
    'uses the correct database relation before pagination for favorites=%s',
    async (favorites, selection) => {
      const result = Promise.resolve({ data: [], error: null });
      const query = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: result.then.bind(result),
      };
      const from = vi.fn().mockReturnValue(query);
      mock.requireUser.mockResolvedValue({
        db: { from },
        user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      });
      const response = await GET(
        new Request(
          'https://example.com/api/data/memories' + (favorites ? '?favorites=' + favorites : ''),
        ),
        { params: Promise.resolve({ resource: 'memories' }) },
      );
      expect(response.status).toBe(200);
      expect(from).toHaveBeenCalledWith('memories');
      expect(query.select).toHaveBeenCalledWith(selection);
      expect(query.limit).toHaveBeenCalledWith(24);
    },
  );
});
