import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const anonKey = process.env["SUPABASE_ANON_KEY"];

// Lazy singleton — only initialised when Supabase env vars are present
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
