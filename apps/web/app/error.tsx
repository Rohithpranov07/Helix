"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-semibold text-white/80">Something went wrong</h2>
      <p className="text-sm text-white/40 max-w-sm">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={reset}
        className="px-5 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white/70 border border-white/10 transition-colors cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
