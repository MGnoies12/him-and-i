import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  write: vi.fn(),
  remove: vi.fn(),
  rmdir: vi.fn(),
  share: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mock.write, deleteFile: mock.remove, rmdir: mock.rmdir },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: mock.share } }));
import { downloadExport, purgeNativeExports } from '@/lib/data-export';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mock.fetch);
  mock.fetch.mockResolvedValue(new Response('{"synthetic":true}', { status: 200 }));
  mock.write.mockResolvedValue({ uri: 'file:///synthetic-cache/exports/test.json' });
  mock.remove.mockResolvedValue(undefined);
  mock.rmdir.mockResolvedValue(undefined);
  mock.share.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());
describe('native export integration boundary (plugins mocked, not a device test)', () => {
  it('requests the separate owner-only cycle export and shares only a scoped cache file', async () => {
    await downloadExport('cycle');
    expect(mock.fetch).toHaveBeenCalledWith('/api/export?scope=cycle', { cache: 'no-store' });
    expect(mock.write).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: 'CACHE',
        encoding: 'utf8',
        data: '{"synthetic":true}',
        path: expect.stringMatching(/^exports\/.+-private-cycle\.json$/),
      }),
    );
    expect(mock.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///synthetic-cache/exports/test.json'] }),
    );
    expect(mock.remove).toHaveBeenCalledOnce();
  });
  it('cleans the temporary file even if sharing fails', async () => {
    mock.share.mockRejectedValue(new Error('Synthetic share failure'));
    await expect(downloadExport('account')).rejects.toThrow('Synthetic share failure');
    expect(mock.remove).toHaveBeenCalledOnce();
  });
  it('never writes an unauthorized export and clears interrupted-share cache at startup', async () => {
    mock.fetch.mockResolvedValue(new Response('{"error":"unauthenticated"}', { status: 401 }));
    await expect(downloadExport('cycle')).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mock.write).not.toHaveBeenCalled();
    await purgeNativeExports();
    expect(mock.rmdir).toHaveBeenCalledWith({
      path: 'exports',
      directory: 'CACHE',
      recursive: true,
    });
  });
});
