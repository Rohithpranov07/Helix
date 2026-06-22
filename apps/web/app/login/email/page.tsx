"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Map Firebase auth error codes to friendly copy.
function messageForCode(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/email-already-in-use":
      return "An account already exists for that email. Try signing in.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function EmailLoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/chat");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(messageForCode(code));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in with email"}
          </CardTitle>
          <CardDescription>
            {mode === "signup"
              ? "Enter an email and password to get started."
              : "Enter your credentials to access HELIX."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
              onClick={() => {
                setError(null);
                setMode((m) => (m === "signin" ? "signup" : "signin"));
              }}
            >
              {mode === "signin"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
              onClick={() => router.push("/login")}
            >
              ← Back to all sign-in options
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
