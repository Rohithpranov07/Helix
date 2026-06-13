// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing
// SQLi — user input is concatenated directly into a SQL string passed to the
//        unsafe_search RPC function. No parameterisation or escaping.
// Fix: use parameterised queries — supabase.from('products').select().ilike('name', `%${q}%`)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Widget Pro", price: 29.99, description: "A professional-grade widget" },
  { id: "2", name: "Gadget Ultra", price: 49.99, description: "Ultra performance gadget" },
  { id: "3", name: "Doohickey Basic", price: 9.99, description: "Entry-level doohickey" },
  { id: "4", name: "Thingamajig X", price: 19.99, description: "The versatile thingamajig" },
  { id: "5", name: "Gizmo Plus", price: 39.99, description: "Enhanced gizmo with extras" },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  // ── VULNERABILITY: raw string concatenation into SQL ──────────────────────
  const rawSql =
    "SELECT id, name, price, description FROM products " +
    "WHERE name ILIKE '%" + q + "%' " +
    "OR description ILIKE '%" + q + "%'";
  // ─────────────────────────────────────────────────────────────────────────

  const supabase = getSupabase();

  if (!supabase) {
    // No Supabase configured — filter mock data (rawSql is still built above)
    const results = MOCK_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase()),
    );
    return NextResponse.json({ products: results, _debug_sql: rawSql });
  }

  // When Supabase is configured, call the unsafe_search RPC with the raw SQL
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ data: Product[] | null; error: { message: string } | null }>;
  }).rpc("unsafe_search", { sql_query: rawSql });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ products: data ?? [], _debug_sql: rawSql });
}
