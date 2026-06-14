"use client";
import { cn } from "@/lib/utils";

interface DarkHorizonGlowProps {
  className?: string;
  variant?: "horizon" | "azure";
}

export function DarkHorizonGlow({ className, variant = "horizon" }: DarkHorizonGlowProps) {
  const gradient = variant === "horizon" 
    ? "radial-gradient(125% 125% at 50% 90%, #000000 40%, #0d1a36 100%)"
    : "radial-gradient(125% 125% at 50% 100%, #000000 40%, #010133 100%)";

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-0", className)}
      style={{
        background: gradient,
      }}
    />
  );
}
