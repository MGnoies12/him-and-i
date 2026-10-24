import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicConfig } from '@/lib/config';
import type { Database } from '@/types/database';
export async function serverSupabase() {
  const config = publicConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => store.set(name, value, { ...options, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })); }
        catch { /* Server Components cannot write cookies; the proxy refreshes them. */ }
      },
    },
  });
}
