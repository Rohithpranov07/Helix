"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NavHeader({ className }: { className?: string }) {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <nav className={cn("fixed top-6 left-1/2 -translate-x-1/2 z-[100]", className)}>
      <ul
        className="relative mx-auto flex w-fit rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-x-auto max-w-[calc(100vw-48px)]"
        onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
      >
        <Tab setPosition={setPosition} href="/dashboard">Home</Tab>
        <Tab setPosition={setPosition} href="/dashboard/genome">Genome</Tab>
        <Tab setPosition={setPosition} href="/dashboard/immune">Immune</Tab>
        <Tab setPosition={setPosition} href="/dashboard/logs">Logs</Tab>
        <Tab setPosition={setPosition} href="/dashboard/metabolism">Metabolism</Tab>
        <Tab setPosition={setPosition} href="/dashboard/incidents">Reflex</Tab>
        <Tab setPosition={setPosition} href="/dashboard/shadow">Shadow</Tab>
        <Tab setPosition={setPosition} href="/dashboard/antibodies">Antibodies</Tab>

        <Cursor position={position} />
      </ul>
    </nav>
  );
}

const Tab = ({
  children,
  setPosition,
  href,
}: {
  children: React.ReactNode;
  setPosition: any;
  href: string;
}) => {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;

        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
      }}
      className="relative z-10 block cursor-pointer text-xs font-bold uppercase tracking-widest text-white mix-blend-difference md:text-xs"
    >
      <Link href={href} prefetch={true} className="block px-4 py-2 md:px-6 md:py-2.5">
        {children}
      </Link>
    </li>
  );
};

const Cursor = ({ position }: { position: any }) => {
  return (
    <motion.li
      animate={{
        ...position,
        transition: { type: "spring", stiffness: 300, damping: 30 }
      }}
      className="absolute z-0 h-[34px] rounded-full bg-white md:h-[38px] top-1.5"
    />
  );
};
