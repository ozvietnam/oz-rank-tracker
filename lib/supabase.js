import { createClient } from '@supabase/supabase-js';

// Returns a Supabase client using the service-role key (server-side only),
// or null when the env vars are not configured (app falls back to localStorage).
export function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
