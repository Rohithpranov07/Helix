// Firebase web client — single shared app instance.
//
// The config values are publishable by design (Firebase web API keys are not
// secrets; access is gated by Auth + Security Rules), so they live in
// NEXT_PUBLIC_* env vars rather than being hardcoded. Enable the Google,
// GitHub and Email/Password providers in the Firebase console for sign-in to
// succeed.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  type Auth,
} from "firebase/auth";

// NEXT_PUBLIC_* vars are inlined by Next.js only when read with a static
// literal key (not via process.env[dynamic]), so each is referenced directly
// here. require() fails loudly if a value is missing at build/runtime rather
// than handing Firebase `undefined` and getting an opaque error later.
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const firebaseConfig = {
  apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: required("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: required("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: required("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

// Reuse the existing app across hot-reloads / multiple imports.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Analytics only runs in a browser that supports it; guard so server-side
// rendering never calls getAnalytics (which throws outside the browser).
export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  return (await isSupported()) ? getAnalytics(app) : null;
}
