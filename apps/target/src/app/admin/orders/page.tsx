// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing
// missingRLS — the `orders` table has no Row-Level Security policy enabled.
//              Any authenticated user can read ALL orders from all users by
//              calling supabase.from('orders').select('*') — no user filter applied.
// Fix: enable RLS on `orders`, add a policy:
//      CREATE POLICY "users_own_orders" ON orders
//        FOR SELECT USING (auth.uid() = user_id);
import { getSupabase } from "@/lib/supabase";

interface Order {
  id: string;
  user_id: string;
  product_name: string;
  amount: number;
  created_at: string;
}

const MOCK_ORDERS: Order[] = [
  { id: "o1", user_id: "user-alice", product_name: "Widget Pro", amount: 29.99, created_at: "2026-01-10T10:00:00Z" },
  { id: "o2", user_id: "user-bob", product_name: "Gadget Ultra", amount: 49.99, created_at: "2026-01-11T14:30:00Z" },
  { id: "o3", user_id: "user-carol", product_name: "Doohickey Basic", amount: 9.99, created_at: "2026-01-12T09:15:00Z" },
];

async function fetchAllOrders(): Promise<Order[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_ORDERS;

  // ── VULNERABILITY: no user_id filter — any authenticated user sees all orders ──
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  // ─────────────────────────────────────────────────────────────────────────────

  if (error) return MOCK_ORDERS;
  return (data ?? []) as Order[];
}

export default async function AdminOrdersPage() {
  const orders = await fetchAllOrders();

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1>ShopLite — All Orders (Admin)</h1>
      <p style={{ color: "#c00" }}>
        ⚠ DEMO VULN: RLS missing — all orders from all users are visible here
        regardless of who is logged in.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={th}>Order ID</th>
            <th style={th}>User ID</th>
            <th style={th}>Product</th>
            <th style={th}>Amount</th>
            <th style={th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td style={td}>{o.id}</td>
              <td style={td}>{o.user_id}</td>
              <td style={td}>{o.product_name}</td>
              <td style={td}>${o.amount.toFixed(2)}</td>
              <td style={td}>{new Date(o.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 24 }}>
        <a href="/search">← Back to search</a>
      </p>
    </main>
  );
}

const th: React.CSSProperties = { border: "1px solid #ccc", padding: "8px 12px", textAlign: "left" };
const td: React.CSSProperties = { border: "1px solid #ccc", padding: "8px 12px" };
