import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicConfig } from '@/lib/config';
export async function proxy(request: NextRequest) {
  const config = publicConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          }),
        );
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw.js|api/jobs).*)'],
};
