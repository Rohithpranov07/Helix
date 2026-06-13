import type { Metadata } from "next";
import "./globals.css";

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
