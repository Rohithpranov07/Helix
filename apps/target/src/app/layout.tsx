import type { Metadata } from "next";
import { AdminBanner } from "./_components/AdminBanner";

export const metadata: Metadata = {
  title: "ShopLite",
  description: "Demo target app — T1.1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AdminBanner />
        {children}
      </body>
    </html>
  );
}
