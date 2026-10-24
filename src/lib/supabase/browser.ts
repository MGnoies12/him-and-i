'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicConfig } from '@/lib/config';
import type { Database } from '@/types/database';
let instance: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function browserSupabase() {
  const config = publicConfig();
  if (!config) return null;
  instance ??= createBrowserClient<Database>(config.url, config.key,{cookieOptions:{sameSite:'lax',secure:typeof location!=='undefined'&&location.protocol==='https:'}});
  return instance;
}
