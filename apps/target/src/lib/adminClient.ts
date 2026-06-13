// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing
// secretLeak — Supabase service-role key hard-coded and exported for client-side use.
// Fix: service keys must only live in server-side env vars (SUPABASE_SERVICE_KEY),
//      never bundled into client JavaScript.
"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "https://fakeprojref.supabase.co";

// ⚠ DEMO ONLY — fake JWT-format service key, not a real secret
export const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZha2VkZW1vcHJvamVjdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0." +
  "HELIX_DEMO_FAKE_KEY_DO_NOT_USE_IN_PRODUCTION";

// This admin client is intentionally exported from a "use client" module,
// making the service key visible in the browser bundle.
export const adminSupabase = createClient(url, SUPABASE_SERVICE_KEY);
