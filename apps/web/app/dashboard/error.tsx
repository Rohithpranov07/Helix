"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
      <div className="w-14 h-14 rounded-2xl border border-red-500/20 bg-red-500/10 flex items-center justify-center">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-7 text-red-400">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white/80 mb-1">Dashboard error</h2>
        <p className="text-sm text-white/35 max-w-sm">{error.message || "An unexpected error occurred in the dashboard."}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white/70 border border-white/10 transition-colors cursor-pointer"
        >
          Retry
        </button>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
