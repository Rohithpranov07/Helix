"use client";

import { useRouter } from "next/navigation";
import { CosmicParallaxBg } from "@/components/ui/parallax-cosmic-background";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <CosmicParallaxBg
        head="HELIX"
        text="Secure, Self-Healing, Alive, Immortal"
        loop={true}
      />

      {/* Get Started button — anchored to sphere surface below subtitle */}
      <div className="absolute inset-0 z-10 flex items-end justify-center pb-[5%] pointer-events-none">
        <button
          onClick={() => router.push("/chat")}
          className="pointer-events-auto group relative px-8 py-3 text-xs font-semibold tracking-[0.25em] uppercase text-white/90 transition-all duration-300"
        >
          {/* border ring */}
          <span className="absolute inset-0 rounded-full border border-white/20 group-hover:border-white/40 transition-colors duration-300" />
          {/* glow fill on hover */}
          <span className="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-300" />
          <span className="relative">Get Started →</span>
        </button>
      </div>
    </div>
  );
}
