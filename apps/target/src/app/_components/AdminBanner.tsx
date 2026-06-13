// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing
// secretLeak — this client component imports adminClient which contains the
// service-role key, causing it to be bundled into client-side JavaScript.
"use client";

import { SUPABASE_SERVICE_KEY } from "@/lib/adminClient";

export function AdminBanner() {
  // Key is in the bundle — visible in browser DevTools > Sources
  return (
    <div
      style={{
        background: "#fff3cd",
        border: "1px solid #ffc107",
        padding: "8px 12px",
        fontSize: 12,
        color: "#856404",
      }}
      data-demo-key={SUPABASE_SERVICE_KEY.slice(-12)}
    >
      ⚠ Admin mode active (HELIX demo — service key in bundle)
    </div>
  );
}
