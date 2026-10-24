import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/config';
/** Optional token-hash email templates support confirmation/reset across browsers and native shells. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : url.origin;
  const db = await serverSupabase();
  const token = url.searchParams.get('token_hash');
  const type = z
    .enum(['email', 'recovery', 'signup', 'email_change'])
    .safeParse(url.searchParams.get('type'));
  if (db && token && token.length <= 256 && type.success) {
    const { error } = await db.auth.verifyOtp({ token_hash: token, type: type.data });
    if (!error)
      return NextResponse.redirect(
        new URL(
          safeRedirect(
            url.searchParams.get('next'),
            type.data === 'recovery' ? '/update-password' : '/home',
          ),
          origin,
        ),
      );
  }
  return NextResponse.redirect(new URL('/login?error=auth_callback', origin));
}
