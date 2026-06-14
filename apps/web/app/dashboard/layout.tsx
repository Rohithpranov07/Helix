"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavHeader } from "@/components/ui/nav-header";

const NAV_LINKS = [
  { href: "/dashboard/immune", label: "Immune" },
  { href: "/dashboard/incidents", label: "Incidents" },
  { href: "/dashboard/genome", label: "Genome" },
  { href: "/dashboard/metabolism", label: "Metabolism" },
  { href: "/dashboard/shadow", label: "Shadow" },
  { href: "/dashboard/antibodies", label: "Antibodies" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-black text-slate-50 font-sans relative">
      <NavHeader />
      {/* Subtle Grid Background */}
      <div 
          className="fixed inset-0 z-0 pointer-events-none" 
          style={{ 
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px)`, 
              backgroundSize: '40px 40px' 
          }} 
      />
      {/* Page content */}
      <main className="relative z-10 pt-24">
        {children}
      </main>
    </div>
  );
}
