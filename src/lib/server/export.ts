import 'server-only';

/** Advance by rows actually returned: a provider row cap may be below the requested page size. */
export async function* exportPages<T>(
  load: (offset: number, size: number) => Promise<T[]>,
  pageSize = 500,
) {
  let offset = 0;
  while (true) {
    const rows = await load(offset, pageSize);
    if (!rows.length) return;
    yield rows;
    offset += rows.length;
  }
}
export function streamJSON(chunks: AsyncGenerator<string>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch {
        controller.error(new Error('export_failed'));
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}
