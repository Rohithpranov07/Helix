"use client";

import { NavHeader } from "@/components/ui/nav-header";
import StaggeredMenu from "@/components/ui/StaggeredMenu";

// Right-side staggered overlay menu — mirrors the dashboard routes.
const MENU_ITEMS = [
  { label: "Home",       ariaLabel: "Go to the dashboard home",     link: "/dashboard" },
  { label: "Genome",     ariaLabel: "Go to Genome",                 link: "/dashboard/genome" },
  { label: "Immune",     ariaLabel: "Go to Immune system",          link: "/dashboard/immune" },
  { label: "Reflex",     ariaLabel: "Go to Resurrection Reflex",    link: "/dashboard/incidents" },
  { label: "Logs",       ariaLabel: "Go to Logs",                   link: "/dashboard/logs" },
  { label: "Metabolism", ariaLabel: "Go to Metabolism",            link: "/dashboard/metabolism" },
  { label: "Shadow",     ariaLabel: "Go to Shadow",                 link: "/dashboard/shadow" },
  { label: "Antibodies", ariaLabel: "Go to Immune Memory",          link: "/dashboard/antibodies" },
];

const SOCIAL_ITEMS = [
  { label: "GitHub", link: "https://github.com" },
  { label: "Docs",   link: "https://nextjs.org" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen text-slate-50 font-sans relative" style={{ backgroundColor: "#020610" }}>
      <NavHeader />

      {/* Right-side staggered overlay menu */}
      <StaggeredMenu
        position="right"
        isFixed
        items={MENU_ITEMS}
        socialItems={SOCIAL_ITEMS}
        displaySocials
        displayItemNumbering
        menuButtonColor="#000"
        openMenuButtonColor="#000"
        changeMenuColorOnOpen
        colors={["#1b2a4a", "#38bdf8"]}
        accentColor="#38bdf8"
      />

      {/* Page content */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}
