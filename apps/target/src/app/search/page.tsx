// HELIX-DEMO-VULN: intentionally insecure for authorized self-testing
// XSS — the search query param and product names are injected into the DOM
//        via dangerouslySetInnerHTML without any sanitization.
// Fix: render text content with React's default escaping (just use {variable}),
//      never dangerouslySetInnerHTML with user-controlled data.
import { Suspense } from "react";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

async function fetchProducts(q: string): Promise<Product[]> {
  if (!q) return [];
  try {
    const res = await fetch(
      `http://localhost:3001/api/products/search?q=${encodeURIComponent(q)}`,
      { cache: "no-store" },
    );
    const json = (await res.json()) as { products?: Product[] };
    return json.products ?? [];
  } catch {
    return [];
  }
}

async function SearchResults({ q }: { q: string }) {
  const products = await fetchProducts(q);

  return (
    <div>
      {/* ── VULNERABILITY: reflected XSS — q injected unsanitised ─────────── */}
      <p>
        Search results for:{" "}
        <strong dangerouslySetInnerHTML={{ __html: q }} />
      </p>
      {/* ─────────────────────────────────────────────────────────────────── */}

      {products.length === 0 && q && <p>No products found.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {products.map((p) => (
          <li
            key={p.id}
            style={{ border: "1px solid #ccc", padding: "12px", margin: "8px 0", borderRadius: 4 }}
          >
            {/* ── VULNERABILITY: product name rendered unsanitised ──────── */}
            <h3 dangerouslySetInnerHTML={{ __html: p.name }} />
            {/* ─────────────────────────────────────────────────────────── */}
            <p>Price: ${p.price.toFixed(2)}</p>
            <p style={{ color: "#666" }}>{p.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1>ShopLite — Product Search</h1>
      <form method="GET" action="/search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products..."
          style={{ width: "70%", padding: "8px", fontSize: 16 }}
        />
        <button type="submit" style={{ marginLeft: 8, padding: "8px 16px" }}>
          Search
        </button>
      </form>

      <Suspense fallback={<p>Searching…</p>}>
        <SearchResults q={q} />
      </Suspense>

      <p style={{ marginTop: 40 }}>
        <a href="/admin/orders">Admin: View Orders</a> |{" "}
        <a href="/login">Login</a>
      </p>
    </main>
  );
}
