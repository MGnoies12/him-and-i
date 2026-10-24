import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { serverSupabase } from '@/lib/supabase/server';
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) throw new ApiError('invalid_origin', 403);
  const allowed = [new URL(request.url).origin];
  const host = request.headers.get('host');
  if (host) {
    allowed.push(`https://${host}`);
    if (
      process.env.NODE_ENV !== 'production' ||
      host.startsWith('localhost:') ||
      host.startsWith('127.0.0.1:')
    )
      allowed.push(`http://${host}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL)
    allowed.push(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  if (!allowed.includes(origin)) throw new ApiError('invalid_origin', 403);
}
export async function requireUser() {
  const db = await serverSupabase();
  if (!db) throw new ApiError('configuration_required', 503);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new ApiError('unauthenticated', 401);
  return { db, user };
}
export function unwrap<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): T {
  if (result.error) {
    const known = [
      'rate_limited',
      'already_member',
      'couple_full',
      'invalid_invitation',
      'membership_required',
      'partner_required',
      'invalid_letter_state',
      'letter_unavailable',
      'letter_locked',
      'not_found',
      'forbidden',
      'invalid_attachment',
      'too_many_files',
      'unsupported_media',
      'answers_private',
      'invalid_date',
      'invalid_answer',
      'invalid_game',
    ];
    const code =
      known.find((c) => result.error!.message === c) ||
      (result.error.code === '23505' ? 'already_exists' : 'request_failed');
    throw new ApiError(code, code === 'rate_limited' ? 429 : 400);
  }
  return result.data;
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: 'validation_failed',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  if (error instanceof ApiError)
    return NextResponse.json({ error: error.code }, { status: error.status });
  // Intentionally do not log provider responses, request bodies, private links, or tokens.
  return NextResponse.json({ error: 'request_failed' }, { status: 500 });
}

export function requireData<T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  const data = unwrap(result);
  if (data === null || data === undefined) throw new ApiError('not_found', 404);
  return data;
}

export async function readLimitedBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new ApiError('payload_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ApiError('payload_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function readJSONBody(request: Request, maxBytes = 64000): Promise<unknown> {
  const bytes = await readLimitedBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError('validation_failed', 422);
  }
}
