// Re-exports for convenience — prefer utils/supabase/* directly in new code
export { createClient as createServerClient } from "@/utils/supabase/server";
export { createClient as createBrowserClient } from "@/utils/supabase/client";

import { createClient } from "@supabase/supabase-js";

// Legacy lazy singleton used by API routes that don't have a cookie store
// (e.g. the SQLi demo endpoint). Uses the publishable key (anon-equivalent).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}
