"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Logging in…");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as { error?: string; user?: { email: string } };
    if (json.error) {
      setMsg("Error: " + json.error);
    } else {
      setMsg("Logged in as " + (json.user?.email ?? "unknown"));
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1>ShopLite Login</h1>
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>
        <button type="submit" style={{ padding: "8px 24px" }}>Login</button>
      </form>
      {msg && <p style={{ marginTop: 16, color: "#333" }}>{msg}</p>}
      <p style={{ marginTop: 24 }}>
        <a href="/search">Browse products</a>
      </p>
    </main>
  );
}
