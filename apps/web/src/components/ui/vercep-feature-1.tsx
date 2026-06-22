import { Cpu, ShieldCheck, Lock, TrendingUp, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Marquee } from "@/components/ui/marquee";

// Mid-Century Modern palette — matches the Antibody Library page exactly.
const ATOMIC = { cream: "#f3e8d0", mustard: "#e3a23c", terracotta: "#cc6b49", teal: "#3f7a72", walnut: "#3a2e26", rust: "#b5482f" };

// Threat signatures the immune system has already recognized — the same shape
// as a real antibody's `signature` field, scrolling by as proof of recall.
const recognizedSignatures = [
  "SQL injection via unescaped user input",
  "XSS via unsanitized HTML in comment field",
  "Auth bypass via missing middleware guard",
  "Missing RLS policy on shared tables",
  "Secret leak via hardcoded credentials",
  "Null reference in checkout handler",
  "Path traversal via unsanitized filename",
  "CSRF token missing on state-changing routes",
  "Insecure deserialization of user input",
  "Race condition in payment processing",
  "Open redirect via unchecked query param",
  "Privilege escalation via role tampering",
];

interface Feature {
  description: string;
  icon: LucideIcon;
  title: string;
}

const features: Feature[] = [
  {
    title: "Recognized instantly",
    description:
      "768-dim vector embeddings mean a familiar threat pattern is recalled in milliseconds — no full re-analysis required.",
    icon: Cpu,
  },
  {
    title: "Proven before stored",
    description:
      "Every antibody is minted only after a Shadow proof confirms the fix actually works — never on assumption.",
    icon: ShieldCheck,
  },
  {
    title: "Permanent, not patched-over",
    description:
      "Once a threat is recognized, it's blocked permanently — that exact pattern can never land in this codebase again.",
    icon: Lock,
  },
  {
    title: "Grows with every incident",
    description:
      "Each vulnerability and incident HELIX resolves adds one more entry to the library — the immune system gets smarter with every reflex.",
    icon: TrendingUp,
  },
];

export const Component = () => {
  const m1 = recognizedSignatures.slice(0, recognizedSignatures.length / 3);
  const m2 = recognizedSignatures.slice(recognizedSignatures.length / 3, (recognizedSignatures.length / 3) * 2);
  const m3 = recognizedSignatures.slice((recognizedSignatures.length / 3) * 2);

  return (
    <section className="relative pt-20 sm:pt-32" style={{ background: ATOMIC.cream }}>
      <div className="mx-auto max-w-full">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center space-y-4 px-5 text-center md:px-10">
          <h2 className="max-w-3xl font-medium text-4xl sm:text-5xl lg:text-6xl" style={{ color: ATOMIC.walnut }}>
            Nothing gets past the same way twice
          </h2>
          <p className="max-w-xl text-base md:text-lg" style={{ color: `${ATOMIC.walnut}aa` }}>
            Every vulnerability and incident HELIX resolves becomes a permanent memory. The next time that exact
            pattern appears — anywhere in the codebase — it&rsquo;s recognized and blocked before it can land.
          </p>

          <div className="relative mx-auto max-w-3xl overflow-hidden">
            <div className="absolute left-0 z-50 h-full w-20" style={{ background: `linear-gradient(to right, ${ATOMIC.cream}, transparent)` }} />
            <div className="absolute right-0 z-50 h-full w-20" style={{ background: `linear-gradient(to left, ${ATOMIC.cream}, transparent)` }} />

            <div className="-mx-6 flex w-screen flex-col md:-mx-10 lg:-mx-16">
              <Marquee className="[--duration:45s] [--gap:0.75rem]" repeat={4}>
                {m1.map((q) => (
                  <Badge
                    className="rounded-none border px-3 py-1 font-mono"
                    style={{ background: ATOMIC.terracotta, borderColor: ATOMIC.terracotta, color: "#fff" }}
                    key={q}
                    size="lg"
                    variant="outline"
                  >
                    {q}
                  </Badge>
                ))}
              </Marquee>

              <Marquee className="[--duration:50s] [--gap:0.75rem]" repeat={4} reverse>
                {m2.map((q) => (
                  <Badge
                    className="rounded-none border px-3 py-1 font-mono"
                    style={{ background: ATOMIC.mustard, borderColor: ATOMIC.mustard, color: "#fff" }}
                    key={q}
                    size="lg"
                    variant="outline"
                  >
                    {q}
                  </Badge>
                ))}
              </Marquee>

              <Marquee className="[--duration:42s] [--gap:0.75rem]" repeat={4}>
                {m3.map((q) => (
                  <Badge
                    className="rounded-none border px-3 py-1 font-mono"
                    style={{ background: ATOMIC.teal, borderColor: ATOMIC.teal, color: "#fff" }}
                    key={q}
                    size="lg"
                    variant="outline"
                  >
                    {q}
                  </Badge>
                ))}
              </Marquee>
            </div>
          </div>
        </div>

        <div
          className="mt-10 grid grid-cols-1 border-t border-dashed sm:grid-cols-2 lg:grid-cols-4"
          style={{ borderColor: `${ATOMIC.walnut}33` }}
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const isLastCol = i === features.length - 1;
            return (
              <div
                key={feature.title}
                className="flex flex-col gap-5 border-dashed px-5 py-8 sm:border-r lg:py-10 lg:px-6"
                style={{ borderColor: isLastCol ? "transparent" : `${ATOMIC.walnut}33` }}
              >
                <div
                  className="flex size-12 items-center justify-center rounded-full"
                  style={{ background: `${ATOMIC.terracotta}1f` }}
                >
                  <Icon className="size-6" strokeWidth={1.5} style={{ color: ATOMIC.terracotta }} />
                </div>

                <div className="flex flex-col gap-2 pt-10 lg:pt-20">
                  <h3 className="font-medium text-2xl tracking-tight sm:text-3xl" style={{ color: ATOMIC.walnut }}>
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed" style={{ color: `${ATOMIC.walnut}99` }}>{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
