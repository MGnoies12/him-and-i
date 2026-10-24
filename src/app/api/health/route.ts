import { NextResponse } from 'next/server';
import { publicConfig } from '@/lib/config';
import { adminSupabase } from '@/lib/server/admin';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
let cached: { ready: boolean; until: number } | undefined;
export async function GET() {
  let ready = false;
  if (publicConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (cached && cached.until > Date.now()) ready = cached.ready;
    else {
      try {
        // LIMIT 0 checks credentials/schema without retrieving anybody's personal information.
        const { error } = await adminSupabase()
          .from('profile_preferences')
          .select('owner_id,onboarding_completed_at')
          .limit(0)
          .abortSignal(AbortSignal.timeout(5000));
        ready = !error;
      } catch {
        /* Never return/log provider credentials, raw errors or personal records. */
      }
      cached = { ready, until: Date.now() + 30000 };
    }
  }
  return NextResponse.json(
    { ready, mode: ready ? 'configured' : 'setup-required' },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
