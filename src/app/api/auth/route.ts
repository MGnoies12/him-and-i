import { NextResponse } from 'next/server';
import { authSchema } from '@/schemas/actions';
import { serverSupabase } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/config';
import { assertSameOrigin, ApiError, failure, readJSONBody, unwrap } from '@/lib/server/http';
import { limitAuth } from '@/lib/server/rate-limit';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    limitAuth(request);
    const db = await serverSupabase();
    if (!db) throw new ApiError('configuration_required', 503);
    const input = authSchema.parse(await readJSONBody(request, 4000));
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    switch (input.type) {
      case 'login': {
        const { error } = await db.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });
        if (error?.status === 429) throw new ApiError('rate_limited', 429);
        if (error && error.status && error.status >= 500) throw new ApiError('request_failed', 502);
        if (error)
          throw new ApiError(
            error.code === 'email_not_confirmed' ? 'email_not_confirmed' : 'invalid_credentials',
            401,
          );
        const personal = await db
          .from('profile_preferences')
          .select('onboarding_completed_at')
          .maybeSingle();
        if (personal.error) throw new ApiError('server_configuration_required', 503);
        const destination = safeRedirect(input.next);
        return NextResponse.json({
          redirect: personal.data?.onboarding_completed_at
            ? destination
            : '/onboarding?next=' + encodeURIComponent(destination),
        });
      }
      case 'signup': {
        const next = '/onboarding?next=' + encodeURIComponent(safeRedirect(input.next));
        const { data, error } = await db.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: { display_name: input.display_name, gender: input.gender },
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error)
          throw new ApiError(
            error.status === 429 ? 'rate_limited' : 'signup_failed',
            error.status === 429 ? 429 : 400,
          );
        return NextResponse.json(data.session ? { redirect: next } : { message: 'check_email' });
      }
      case 'reset': {
        const { error } = await db.auth.resetPasswordForEmail(input.email, {
          redirectTo: `${origin}/auth/callback?next=/update-password`,
        });
        if (error) throw new ApiError('request_failed', 400);
        return NextResponse.json({ message: 'reset_email' });
      }
      case 'password': {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new ApiError('unauthenticated', 401);
        const { error } = await db.auth.updateUser({ password: input.password });
        if (error) throw new ApiError('request_failed', 400);
        return NextResponse.json({ redirect: '/home' });
      }
      case 'signout': {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (user) {
          let remove = db.from('notification_subscriptions').delete().eq('owner_id', user.id);
          if (!input.everywhere && input.device_id)
            remove = remove.eq('device_id', input.device_id);
          unwrap(await remove);
        }
        const { error } = await db.auth.signOut({ scope: input.everywhere ? 'global' : 'local' });
        if (error) throw new ApiError('request_failed');
        return NextResponse.json({ redirect: '/login' });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
