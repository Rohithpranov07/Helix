import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AccountMenu } from "@/components/ui/account-menu";

export const metadata: Metadata = {
  title: "HELIX — Vital Signs",
  description: "The living layer for AI-built software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ backgroundColor: "#020610" }}>
        <AuthProvider>
          {children}
          <AccountMenu />
        </AuthProvider>
      </body>
    </html>
  );
}
