import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  requireUser: vi.fn(),
  sign: vi.fn(),
  admin: vi.fn(),
  single: vi.fn(),
}));
vi.mock('@/lib/server/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/http')>()),
  requireUser: mock.requireUser,
}));
vi.mock('@/lib/server/admin', () => ({ adminSupabase: mock.admin }));
import { GET } from '@/app/api/media/[id]/route';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(() => {
  vi.clearAllMocks();
  mock.requireUser.mockResolvedValue({
    db: { from: () => ({ select: () => ({ eq: () => ({ single: mock.single }) }) }) },
  });
  mock.admin.mockReturnValue({ storage: { from: () => ({ createSignedUrl: mock.sign }) } });
  mock.sign.mockResolvedValue({
    data: { signedUrl: 'https://example.supabase.co/short-lived-synthetic-url' },
    error: null,
  });
});
describe('trusted, short-lived media delivery', () => {
  it('checks caller RLS before invoking the privileged signer', async () => {
    mock.single.mockResolvedValue({ data: null, error: null });
    const result = await GET(new Request('https://example.com/api/media/' + id), {
      params: Promise.resolve({ id }),
    });
    expect(result.status).toBe(404);
    expect(mock.admin).not.toHaveBeenCalled();
    expect(mock.sign).not.toHaveBeenCalled();
  });
  it('signs only the RLS-authorized path, with a fixed 60-second lifetime', async () => {
    mock.single.mockResolvedValue({
      data: { storage_path: 'synthetic-owner/synthetic-image.jpg' },
      error: null,
    });
    const result = await GET(
      new Request('https://example.com/api/media/' + id + '?expiresIn=99999999'),
      { params: Promise.resolve({ id }) },
    );
    expect(result.status).toBe(200);
    expect(mock.sign).toHaveBeenCalledWith('synthetic-owner/synthetic-image.jpg', 60);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
});
