"use client";

/**
 * Closing wordmark block — the Helix-branded version of the Skiper19 ending
 * (big domain-scale wordmark over a rounded dark panel with detail rows). It
 * sits at `z-30` so the scroll thread (`z-20`) tucks *behind* it, giving the
 * "thread weaves into the finale" ending from the reference.
 */
export function HelixOutro() {
  return (
    <section className="relative w-full px-3 pb-[22vh] pt-6 md:px-6">
      {/* Only the dark panel sits above the thread (z-30 > thread's z-20), so
          the ribbon weaves behind the block and re-emerges in the space below.
          The section itself stays transparent so the thread shows around it. */}
      <div className="relative z-30 mx-auto w-full overflow-hidden rounded-[2rem] bg-[#050a2e] pb-10 text-[#EAF2FF] md:rounded-[2.5rem]">
        <h2 className="mt-10 text-center text-[16vw] font-black leading-[0.85] tracking-tighter text-[#CCFF00] lg:text-[17vw]">
          helix
        </h2>

        <div className="mt-10 flex w-full flex-col items-start gap-5 px-5 font-medium uppercase tracking-wide md:mt-4 md:flex-row md:justify-between md:px-10">
          <div className="flex w-full items-center justify-between gap-12 md:w-fit md:justify-center">
            <p className="w-fit text-xs text-white/70">
              autonomous <br /> living layer
            </p>
            <p className="w-fit text-right text-xs text-white/70 md:text-left">
              secure · self-healing <br /> alive · immortal
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-12 md:w-fit md:justify-center">
            <p className="w-fit text-xs text-white/70">
              every patch <br /> proven in shadow
            </p>
            <p className="w-fit text-right text-xs text-white/70 md:text-left">
              © 2026 <br /> helix
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
