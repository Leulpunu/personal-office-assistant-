import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicConfig } from '@/lib/supabase/config';
import type { Database } from '@/types/database';

export function createBrowserSupabaseClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  return createBrowserClient<Database>(config.url, config.publishableKey);
}
