"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

// Routes where the account control should not appear (pre-auth surfaces).
const HIDDEN_PREFIXES = ["/login", "/onboarding"];
const HIDDEN_EXACT = ["/"];

/**
 * Fixed top-right account control. Shows the signed-in user with a Logout
 * button once authenticated; on dashboard routes it shifts left to clear the
 * StaggeredMenu hamburger (which lives in the top-right corner). Hidden on the
 * landing/login/onboarding surfaces.
 */
export function AccountMenu() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const hidden =
    HIDDEN_EXACT.includes(pathname) ||
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (hidden || loading || !user) return null;

  // On /dashboard* the hamburger occupies the corner (~2em padding), so move
  // the chip inward; elsewhere (e.g. /chat) the corner is free.
  const onDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const positionClass = onDashboard ? "top-7 right-24" : "top-5 right-6";

  const label = user.displayName ?? user.email ?? "Account";
  const initial = (user.displayName ?? user.email ?? "?").charAt(0).toUpperCase();

  const handleLogout = async () => {
    if (pending) return;
    setPending(true);
    try {
      await signOut();
      router.push("/login");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed z-[120] flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-2 py-1.5 backdrop-blur-xl",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        positionClass
      )}
    >
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt={label}
          className="h-7 w-7 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/80 text-xs font-semibold text-white">
          {initial}
        </span>
      )}
      <span className="hidden max-w-[140px] truncate text-xs font-medium text-white/80 sm:block">
        {label}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="ml-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white/20 disabled:opacity-50"
      >
        {pending ? "…" : "Logout"}
      </button>
    </div>
  );
}
