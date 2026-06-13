-- ShopLite schema — HELIX demo target

-- Products (safe table — RLS enabled)
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON products FOR SELECT USING (true);

-- Orders — HELIX-DEMO-VULN: missingRLS
-- RLS is intentionally NOT enabled on this table.
-- Any authenticated user can read all orders.
-- Fix: ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
--      CREATE POLICY "users_own_orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  product_name TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- INTENTIONALLY MISSING: ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- HELIX-DEMO-VULN: SQLi — unsafe RPC that executes arbitrary SQL
-- This function is intentionally dangerous for authorized self-testing only.
-- Fix: delete this function; use parameterised queries from the application layer.
CREATE OR REPLACE FUNCTION unsafe_search(sql_query TEXT)
RETURNS TABLE(id UUID, name TEXT, price NUMERIC, description TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE sql_query;
END;
$$;
