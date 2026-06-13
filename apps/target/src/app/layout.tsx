import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShopLite",
  description: "Demo target app — T1.1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
