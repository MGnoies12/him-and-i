import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config';
import { ApiError } from './http';
import type { Database } from '@/types/database';
export function adminSupabase() {
  const config = publicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) throw new ApiError('server_configuration_required', 503);
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
