"use client";

import { useEffect, useState } from "react";

function useClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17, 25));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

const bracketCorner = (position: string) =>
  `absolute h-6 w-6 border-white/25 ${position}`;

export function HudOverlay() {
  const time = useClock();

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none">
      {/* corner brackets */}
      <span className={`${bracketCorner("top-6 left-6")} border-t border-l`} />
      <span className={`${bracketCorner("top-6 right-6")} border-t border-r`} />
      <span className={`${bracketCorner("bottom-6 left-6")} border-b border-l`} />
      <span className={`${bracketCorner("bottom-6 right-6")} border-b border-r`} />

      {/* top-left readout */}
      <div className="absolute top-10 left-10 font-mono text-[10px] tracking-[0.2em] text-white/35 leading-relaxed">
        <div>SYS://HELIX_OS</div>
        <div>BUILD&nbsp;v1.0.0</div>
      </div>

      {/* top-right readout */}
      <div className="absolute top-10 right-10 text-right font-mono text-[10px] tracking-[0.2em] text-white/35 leading-relaxed">
        <div>STATUS: NOMINAL</div>
        <div>{time} UTC</div>
      </div>

      {/* center crosshair, offset above headline */}
      <div className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-5 w-5 opacity-25">
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white" />
          <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white" />
        </div>
      </div>

      {/* bottom-left tick scale */}
      <div className="absolute bottom-10 left-10 flex items-end gap-[3px] opacity-25">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="w-px bg-white"
            style={{ height: i % 4 === 0 ? "10px" : "5px" }}
          />
        ))}
      </div>

      {/* bottom-right ref code */}
      <div className="absolute bottom-10 right-10 font-mono text-[10px] tracking-[0.2em] text-white/35">
        ORGAN_SYNC: ACTIVE
      </div>
    </div>
  );
}
