# ShopLite — HELIX Demo Target App

**FOR AUTHORIZED SELF-TESTING ONLY.**  
This app intentionally contains security vulnerabilities so HELIX's Immune System can detect and heal them.

## Running

```bash
pnpm --filter @helix/target dev   # http://localhost:3001
```

Supabase credentials are optional — the app runs with mock data without them.

## Planted Vulnerabilities

### 1. SQLi — `/api/products/search`
**File:** `src/app/api/products/search/route.ts`

User-supplied `?q=` is concatenated directly into a SQL string:
```ts
const rawSql = `SELECT ... WHERE name ILIKE '%` + q + `%'...`;
await supabase.rpc("unsafe_search", { sql_query: rawSql });
```
**Reproduce:** `GET /api/products/search?q=' OR '1'='1`  
**Fix:** Use parameterised queries — `supabase.from('products').select().ilike('name', '%'+q+'%')` (Supabase's PostgREST API escapes automatically), or use `$1` placeholders in SQL.

---

### 2. XSS — `/search`
**File:** `src/app/search/page.tsx`

The `?q=` param and product names are rendered via `dangerouslySetInnerHTML`:
```tsx
<strong dangerouslySetInnerHTML={{ __html: q }} />
```
**Reproduce:** Visit `/search?q=<img src=x onerror=alert(document.cookie)>`  
**Fix:** Remove `dangerouslySetInnerHTML`; use `{q}` — React escapes by default.

---

### 3. missingRLS — `orders` table
**File:** `src/app/admin/orders/page.tsx`, `supabase/migrations/001_shoplite_init.sql`

The `orders` table is created without `ENABLE ROW LEVEL SECURITY`. Any authenticated user calling `supabase.from('orders').select('*')` retrieves every user's orders.  
**Reproduce:** Log in as any user and visit `/admin/orders` — all orders are visible.  
**Fix:**
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
```

---

### 4. secretLeak — client-side service key
**File:** `src/lib/adminClient.ts`

A fake Supabase service-role key is hard-coded inside a `"use client"` module. It is bundled into the browser JavaScript bundle and visible to anyone who inspects the page source.  
**Reproduce:** Run `curl http://localhost:3001/_next/static/chunks/*.js | grep 'HELIX_DEMO_FAKE'`  
**Fix:** Service keys must only exist in server-side environment variables (`SUPABASE_SERVICE_KEY`), never imported from `"use client"` modules.

---

## Supabase Setup (optional)

1. Create a Supabase project.
2. Run `supabase/migrations/001_shoplite_init.sql` in the SQL editor.
3. Run `supabase/seed.sql` to populate data.
4. Set in `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
