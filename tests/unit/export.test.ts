import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { exportPages, streamJSON } from '@/lib/server/export';
describe('complete, bounded-memory account exports', () => {
  it('does not truncate at an unexpectedly small provider row cap', async () => {
    const rows = Array.from({ length: 12 }, (_, id) => ({ id }));
    const load = vi.fn(async (offset: number) => rows.slice(offset, offset + 3));
    const received = [];
    for await (const page of exportPages(load, 500)) received.push(...page);
    expect(received).toEqual(rows);
    expect(load.mock.calls.map((call) => call[0])).toEqual([0, 3, 6, 9, 12]);
  });
  it('emits valid streamed JSON and propagates failures rather than calling an incomplete export successful', async () => {
    async function* data() {
      yield '{"records":[';
      yield '{"id":1}';
      yield ']}';
    }
    expect(await new Response(streamJSON(data())).json()).toEqual({ records: [{ id: 1 }] });
    async function* broken() {
      yield '{';
      throw new Error('private provider error');
    }
    await expect(new Response(streamJSON(broken())).text()).rejects.toThrow('export_failed');
  });
});
