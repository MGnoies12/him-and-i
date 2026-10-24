import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/config';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : url.origin;
  const db = await serverSupabase();
  const code = url.searchParams.get('code');
  if (db && code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeRedirect(url.searchParams.get('next')), origin));
  }
  return NextResponse.redirect(new URL('/login?error=auth_callback', origin));
}
