"use client";

import * as React from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  /** The signed-in Firebase user, or null when signed out. */
  user: User | null;
  /** True until the first auth state resolves — avoids UI flicker on load. */
  loading: boolean;
  /** Sign the current user out everywhere. */
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | undefined>(undefined);

/**
 * Wraps the app so every page shares one auth state. Firebase persists the
 * session in the browser (browserLocalPersistence), so once a user signs in
 * with Google / GitHub / email they stay signed in across navigations and
 * reloads — no re-prompt on /chat, /dashboard, etc. — until they sign out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Guarantee local persistence (it is the default, but be explicit so the
    // "remember me until logout" behaviour can't silently change).
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Non-fatal: a blocked storage env just falls back to default persistence.
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = React.useCallback(() => fbSignOut(auth), []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Access the shared auth state. Must be used within <AuthProvider>. */
export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
