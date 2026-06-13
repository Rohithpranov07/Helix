"use client";

import dynamic from "next/dynamic";

// Dashboard is a pure client polling component — disable SSR so it doesn't
// attempt server-side rendering with unavailable browser APIs.
const Dashboard = dynamic(() => import("./dashboard"), { ssr: false });

export default function Home() {
  return <Dashboard />;
}
