import 'server-only';
import { createHash } from 'node:crypto';
import { ApiError } from './http';
const attempts = new Map<string, { count: number; reset: number }>();
// Process-local defense in depth, not a replacement for Supabase's project-wide Auth limits.
export function limitAuth(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = createHash('sha256').update(address).digest('hex');
  consume(key, 15, 60000);
}
function consume(key: string, budget: number, windowMs: number) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  if (attempts.size > 10000) throw new ApiError('rate_limited', 429);
  const row = attempts.get(key) || { count: 0, reset: now + windowMs };
  row.count++;
  attempts.set(key, row);
  if (row.count > budget) throw new ApiError('rate_limited', 429);
}

export function limitUserAction(id: string, scope: 'mutation' | 'upload' | 'pairing') {
  const key = createHash('sha256').update(`${scope}:${id}`).digest('hex');
  consume(
    key,
    scope === 'upload' ? 30 : scope === 'pairing' ? 10 : 240,
    scope === 'upload' ? 3600000 : 60000,
  );
}
