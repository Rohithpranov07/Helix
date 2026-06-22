import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 8-bit / retro card primitives.
 *
 * Self-contained (no base shadcn `card.tsx` dependency). The pixel look comes
 * from a 1px-offset, square-cornered frame drawn with `bg-foreground` edges
 * around a `bg-card` surface — the classic 8bitcn aesthetic. Colors resolve
 * from the existing CSS variables (`--card`, `--card-foreground`,
 * `--foreground`, `--ring`).
 */
function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative bg-card text-card-foreground flex flex-col gap-6 py-6",
        className
      )}
      {...props}
    >
      {children}

      {/* 8-bit pixel border — offset square frame, no rounded corners */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -top-1 left-0 h-1 w-full bg-foreground dark:bg-ring" />
        <span className="absolute -bottom-1 left-0 h-1 w-full bg-foreground dark:bg-ring" />
        <span className="absolute -left-1 top-0 h-full w-1 bg-foreground dark:bg-ring" />
        <span className="absolute -right-1 top-0 h-full w-1 bg-foreground dark:bg-ring" />
      </div>
    </div>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 px-6", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardContent };
