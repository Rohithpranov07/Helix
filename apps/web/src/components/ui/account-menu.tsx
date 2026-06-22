"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

// Routes where the account control should not appear (pre-auth surfaces).
const HIDDEN_PREFIXES = ["/login", "/onboarding"];
const HIDDEN_EXACT = ["/"];

/**
 * Fixed top-right account control. Collapsed, it shows only the user's avatar
 * (a circular dark chip). On hover/focus it expands smoothly to the left,
 * revealing the name and a Logout button. On dashboard routes it shifts left to
 * clear the StaggeredMenu hamburger; hidden on landing/login/onboarding.
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
      router.push("/");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("group fixed z-[120]", positionClass)}>
      <div
        className={cn(
          "flex items-center justify-end rounded-full border border-white/15 bg-black/60 p-1",
          "backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
          "transition-shadow duration-300 ease-out hover:shadow-[0_10px_44px_rgba(0,0,0,0.6)]"
        )}
      >
        {/* Collapsible detail — revealed to the LEFT of the avatar on hover/focus.
            Animating grid-template-columns from 0fr→1fr smoothly grows the panel
            from a hard zero width to its natural content width. */}
        <div
          className={cn(
            "grid grid-cols-[0fr] opacity-0",
            "transition-[grid-template-columns,opacity] duration-300 ease-out",
            "group-hover:grid-cols-[1fr] group-hover:opacity-100",
            "group-focus-within:grid-cols-[1fr] group-focus-within:opacity-100"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="whitespace-nowrap pl-3 text-xs font-medium text-white/85">
              {label}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
              aria-label="Log out"
              className={cn(
                "whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white",
                "transition-colors hover:bg-white/20 disabled:opacity-50"
              )}
            >
              {pending ? "…" : "Logout"}
            </button>
          </div>
        </div>

        {/* Avatar — always visible, rightmost, the fixed anchor the panel grows from. */}
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={label}
            referrerPolicy="no-referrer"
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover:ring-white/25"
          />
        ) : (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
              "bg-gradient-to-br from-violet-500 to-sky-500 ring-2 ring-white/10",
              "transition-[box-shadow] duration-300 ease-out group-hover:ring-white/25"
            )}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}
