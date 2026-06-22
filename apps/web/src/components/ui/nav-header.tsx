"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "motion/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Spring / easing ──────────────────────────────────────────────────────────
const SP = { stiffness: 240, damping: 28, mass: 0.7 } as const;
// Emil: ease-out for UI entering/exiting — custom cubic for punch
const E_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ── Link config ───────────────────────────────────────────────────────────────
// Primary 4: always visible. Secondary 4: collapse on scroll.
const PRIMARY_LINKS = [
  { href: "/dashboard",            label: "Home"   },
  { href: "/dashboard/genome",     label: "Genome" },
  { href: "/dashboard/immune",     label: "Immune" },
  { href: "/dashboard/incidents",  label: "Reflex" },
] as const;

const SECONDARY_LINKS = [
  { href: "/dashboard/logs",       label: "Logs"       },
  { href: "/dashboard/metabolism", label: "Metabolism" },
  { href: "/dashboard/shadow",     label: "Shadow"     },
  { href: "/dashboard/antibodies", label: "Antibodies" },
] as const;

interface CursorPos { left: number; width: number; opacity: number }

// ── NavHeader ─────────────────────────────────────────────────────────────────
export function NavHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  // Pill follows hover; when no hover it rests on the active route's tab.
  const [position, setPosition] = useState<CursorPos>({ left: 0, width: 0, opacity: 0 });
  // Cached geometry of the tab matching the current route — the pill's resting place.
  const activePosRef = useRef<{ left: number; width: number }>({ left: 0, width: 0 });
  const [shrunken, setShrunken] = useState(false);

  // True while a route transition is in flight (covers the dev on-demand compile
  // wait too) — drives the top progress bar so a click never looks like "no response".
  const [navigating, setNavigating] = useState(false);

  // A tab reports its geometry when it is the active route → pill rests there.
  const reportActive = useCallback((pos: { left: number; width: number }) => {
    activePosRef.current = pos;
    setPosition((pv) => (pv.opacity === 1 && pv.width !== 0 ? pv : { ...pos, opacity: 1 }));
  }, []);

  // Snap the pill back to the active tab when the pointer leaves the bar.
  const restOnActive = useCallback(() => {
    setPosition({ ...activePosRef.current, opacity: activePosRef.current.width ? 1 : 0 });
  }, []);

  // Collapse secondary tabs when user scrolls past 60px
  const { scrollY } = useScroll();
  useEffect(() => {
    return scrollY.on("change", (y) => setShrunken(y > 60));
  }, [scrollY]);

  // Scroll-driven nav sizing (top + padding + cursor height only — background
  // stays a fixed color so the pill doesn't visibly shift/darken while scrolling
  // across pages with different backgrounds behind the backdrop-blur).
  const rawTop      = useTransform(scrollY, [0, 80], [24, 14]);
  const rawPad      = useTransform(scrollY, [0, 80], [6, 2]);
  const rawCurH     = useTransform(scrollY, [0, 80], [36, 26]);

  const top     = useSpring(rawTop,     SP);
  const pad     = useSpring(rawPad,     SP);
  const curH    = useSpring(rawCurH,    SP);

  const bgColor     = "rgba(0,0,0,0.8)";
  const borderColor = "rgba(255,255,255,0.16)";

  return (
    <>
      <TopProgress active={navigating} />
      <motion.nav
        className={cn("fixed left-1/2 -translate-x-1/2 z-100", className)}
        style={{ top }}
      >
        {/* LayoutGroup enables FLIP — pill width change uses transform not layout */}
        <LayoutGroup>
          <motion.ul
            layout
            className="relative mx-auto flex w-fit rounded-full backdrop-blur-xl overflow-hidden"
            style={{
              padding: pad,
              backgroundColor: bgColor,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
            }}
            onMouseLeave={restOnActive}
          >
            {/* Primary tabs — always visible (render visible on first paint, no
                JS-dependent entrance, so they never flash blank on refresh) */}
            {PRIMARY_LINKS.map(({ href, label }) => (
              <Tab
                key={href}
                instant
                setPosition={setPosition}
                href={href}
                active={pathname === href}
                shrunken={shrunken}
                reportActive={reportActive}
                onNavigating={setNavigating}
                router={router}
              >
                {label}
              </Tab>
            ))}

            {/* Secondary tabs — collapse on scroll */}
            <AnimatePresence initial={false}>
              {!shrunken && SECONDARY_LINKS.map(({ href, label }, i) => (
                <Tab
                  key={href}
                  setPosition={setPosition}
                  href={href}
                  active={pathname === href}
                  shrunken={shrunken}
                  reportActive={reportActive}
                  onNavigating={setNavigating}
                  router={router}
                  // Stagger: Emil 30–80ms between items, collapse right-to-left
                  enterDelay={(SECONDARY_LINKS.length - 1 - i) * 0.045}
                  exitDelay={i * 0.04}
                >
                  {label}
                </Tab>
              ))}
            </AnimatePresence>

            {/* ⋯ pill — appears when collapsed, hints at hidden tabs */}
            <AnimatePresence initial={false}>
              {shrunken && (
                <motion.li
                  key="overflow-hint"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1,
                    transition: { delay: 0.18, duration: 0.22, ease: E_OUT } }}
                  exit={{ opacity: 0, scale: 0.8,
                    transition: { duration: 0.15, ease: E_OUT } }}
                  className="relative z-10 flex items-center px-3 cursor-default select-none"
                >
                  <span className="text-white/30 text-[10px] tracking-[0.25em] font-mono">
                    ···
                  </span>
                </motion.li>
              )}
            </AnimatePresence>

            <Cursor position={position} cursorHeight={curH} />
          </motion.ul>
        </LayoutGroup>
      </motion.nav>
    </>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
function Tab({
  children,
  setPosition,
  href,
  active,
  shrunken,
  reportActive,
  onNavigating,
  router,
  enterDelay = 0,
  exitDelay = 0,
  instant = false,
}: {
  children: React.ReactNode;
  setPosition: React.Dispatch<React.SetStateAction<CursorPos>>;
  href: string;
  active: boolean;
  shrunken: boolean;
  reportActive: (pos: { left: number; width: number }) => void;
  onNavigating: (v: boolean) => void;
  router: ReturnType<typeof useRouter>;
  enterDelay?: number;
  exitDelay?: number;
  // When true, render at the visible state on first paint (no mount animation).
  instant?: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // Pre-warm a route once on first hover so the click is instant.
  const warmed = useRef(false);

  // When this tab is the active route, report its geometry so the pill rests here.
  // Re-measure when layout can shift (route change, scroll-collapse).
  useEffect(() => {
    if (!active || !ref.current) return;
    const { width } = ref.current.getBoundingClientRect();
    reportActive({ left: ref.current.offsetLeft, width });
  }, [active, shrunken, reportActive]);

  const prewarm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    // Production: prefetch the RSC payload + JS so navigation is instant.
    router.prefetch(href);
    // Development: `next dev` compiles routes on demand and disables prefetch, so a
    // plain GET on hover kicks off the server compile early — by click time it's warm.
    if (process.env.NODE_ENV === "development") {
      fetch(href, { method: "GET" }).catch(() => {});
    }
  }, [href, router]);

  return (
    <motion.li
      ref={ref}
      layout
      // Enter: clip sweeps in from center, Emil: ease-out, start visible (no scale(0)).
      // `instant` items skip the mount animation so they're present immediately.
      initial={instant ? false : { opacity: 0, clipPath: "inset(0 50% 0 50%)" }}
      animate={{ opacity: 1, clipPath: "inset(0 0% 0 0%)",
        transition: { delay: enterDelay, duration: 0.28, ease: E_OUT } }}
      // Exit: clip collapses to center, faster than enter (Emil asymmetric timing)
      exit={{ opacity: 0, clipPath: "inset(0 50% 0 50%)",
        transition: { delay: exitDelay, duration: 0.18, ease: E_OUT } }}
      onMouseEnter={() => {
        prewarm();
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
      }}
      onFocusCapture={prewarm}
      // Emil: mix-blend-difference keeps text readable against white cursor always
      className="relative z-10 block cursor-pointer text-xs font-bold uppercase tracking-widest text-white mix-blend-difference"
    >
      <Link href={href} prefetch className="block px-5 py-2.5 md:px-6 md:py-2.5">
        {children}
        <LinkPending onChange={onNavigating} />
      </Link>
    </motion.li>
  );
}

// ── LinkPending ────────────────────────────────────────────────────────────────
// Lives inside <Link> so it can read the in-flight navigation state for that link.
// Reports it upward (for the top bar) and shows a per-tab loading shimmer.
function LinkPending({ onChange }: { onChange: (v: boolean) => void }) {
  const { pending } = useLinkStatus();

  useEffect(() => {
    onChange(pending);
    // When this link stops being pending, make sure the global flag clears too.
    return () => onChange(false);
  }, [pending, onChange]);

  return (
    <AnimatePresence>
      {pending && (
        <motion.span
          key="pending"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-2 bottom-1 h-[2px] overflow-hidden rounded-full"
        >
          <motion.span
            className="block h-full w-1/2 rounded-full bg-white"
            animate={{ x: ["-60%", "220%"] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ── TopProgress ────────────────────────────────────────────────────────────────
// Thin top-of-viewport bar shown during any route transition. Eases toward ~90%
// while pending (so long dev compiles still show motion), then completes & fades.
function TopProgress({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    let done: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      setVisible(true);
      setWidth(8);
      const creep = () => {
        setWidth((w) => (w < 90 ? w + (90 - w) * 0.06 : w));
        raf = requestAnimationFrame(creep);
      };
      raf = requestAnimationFrame(creep);
    } else if (visible) {
      setWidth(100);
      done = setTimeout(() => { setVisible(false); setWidth(0); }, 260);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (done) clearTimeout(done);
    };
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200] h-[2px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ── Cursor ─────────────────────────────────────────────────────────────────────
function Cursor({
  position,
  cursorHeight,
}: {
  position: CursorPos;
  cursorHeight: MotionValue<number>;
}) {
  return (
    <motion.li
      // Emil: spring for follow — maintains velocity when direction changes mid-move
      animate={{ left: position.left, width: position.width, opacity: position.opacity }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute z-0 rounded-full bg-white"
      style={{
        height: cursorHeight,
        top: "50%",
        translateY: "-50%",
      }}
    />
  );
}
