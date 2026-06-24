"use client";

import {
  TableOfContents,
  TableOfContentsMobile,
  useScrollSpy,
  type TocItem,
} from "@/components/ui/table-of-contents";

const sections: Array<TocItem & { body: string[] }> = [
  {
    id: "overview",
    title: "Overview",
    depth: 2,
    body: [
      "HELIX is an autonomous living layer for AI-built software. It keeps software aligned to intent, secure, self-healing, and free of entropy — modelled as an organism with organs.",
      "The unifying thesis: intent drift, code drift, vulnerabilities, production failures, and entropy are one phenomenon — divergence over time.",
    ],
  },
  {
    id: "genome",
    title: "Genome",
    depth: 2,
    body: [
      "The Genome captures what you meant to build as an intent strand, then continuously base-pairs it against the actual codebase to catch drift before it compounds.",
    ],
  },
  {
    id: "genome-intent-strand",
    title: "Intent Strand",
    depth: 3,
    body: [
      "Every feature is recorded as an intent_strand — a structured record of intended behavior that the Genome organ checks the live repository against on every change.",
    ],
  },
  {
    id: "immune-system",
    title: "Immune System",
    depth: 2,
    body: [
      "Every change is scanned and classified — SQLi, XSS, authBypass, secretLeak, missingRLS — and matched against a vector antibody library. Known threats are neutralized on sight.",
    ],
  },
  {
    id: "immune-antibody-library",
    title: "Antibody Library",
    depth: 3,
    body: [
      "Novel vulnerabilities are embedded and stored as antibodies in MongoDB's vector index, so the next time a similar pattern appears anywhere in the codebase, it's recognized instantly.",
    ],
  },
  {
    id: "metabolism",
    title: "Metabolism",
    depth: 2,
    body: [
      "Metabolism tracks the codebase's entropy as a continuous time-series — dead code, unused dependencies, and structural decay that accumulates the same way metabolic waste does in a living system.",
    ],
  },
  {
    id: "nervous-system",
    title: "Nervous System & Resurrection Reflex",
    depth: 2,
    body: [
      "When production fails, the Nervous System reconstructs the causal chain from logs and reflexively triggers a healing patch — the Resurrection Reflex — without waiting for a human to notice first.",
    ],
  },
  {
    id: "shadow",
    title: "Shadow",
    depth: 2,
    body: [
      "Before any healing patch reaches production, it runs against a Shadow twin — a full runtime replica that proves behavior-equivalence before promotion.",
    ],
  },
  {
    id: "shadow-invariant",
    title: "The Shadow Invariant",
    depth: 3,
    body: [
      "No write ever reaches the real target without a Shadow proof of verdict:'promote'. This is inviolable — it is the one rule every organ defers to.",
    ],
  },
  {
    id: "vital-signs",
    title: "Vital Signs & Governor",
    depth: 2,
    body: [
      "Vital Signs is the control plane: entropy, incidents, and homeostasis records rendered as a live read on system health. The Governor arbitrates which organ actions are allowed to run and when.",
    ],
  },
  {
    id: "sponsor-stack",
    title: "Sponsor Stack",
    depth: 2,
    body: [
      "Each organ is powered by a fixed set of providers, each scoped to a specific job — no provider does another's work.",
    ],
  },
  {
    id: "sponsor-groq",
    title: "Qwen3.6-27B — Primary LLM",
    depth: 3,
    body: [
      "All reasoning, patch synthesis, drift judgement, causal reconstruction, behaviour-equivalence judgement, and test/assertion generation run through Qwen3.6-27B (served via the NVIDIA OpenAI-compatible API). It's the default and dominant AI provider across nearly every organ.",
    ],
  },
  {
    id: "sponsor-gemini",
    title: "Gemini — Wide-Context Reads",
    depth: 3,
    body: [
      "Gemini is used only where Qwen3.6-27B can't substitute: whole-repo wide-context reads — entropy field computation, intent-code base-pairing across many files at once, and log/UI parsing for the Resurrection Reflex. Never for reasoning, patches, or judgement.",
    ],
  },
  {
    id: "sponsor-mongodb",
    title: "MongoDB — Biology & Memory",
    depth: 3,
    body: [
      "The intent genome, vector antibody library, entropy time-series, and incident & proof records all live in MongoDB — the organism's biological memory.",
    ],
  },
  {
    id: "sponsor-n8n",
    title: "n8n — Autonomic Wiring",
    depth: 3,
    body: [
      "Reflex arcs and scheduled loops — the autonomic nervous system that fires organ actions on a schedule or in response to a signal — are wired through n8n.",
    ],
  },
];

export default function DocsPage() {
  const ids = sections.map((s) => s.id);
  const activeId = useScrollSpy(ids);

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground">
      <TableOfContentsMobile items={sections} activeId={activeId} />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-12 md:grid-cols-[1fr_240px] md:py-20">
        <article className="max-w-2xl space-y-16">
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Documentation
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              How HELIX works
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A guided tour through the organism — its organs, its invariant,
              and the providers powering each one.
            </p>
          </header>

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              {section.depth === 2 ? (
                <h2 className="text-2xl font-semibold tracking-tight">
                  {section.title}
                </h2>
              ) : (
                <h3 className="text-lg font-semibold tracking-tight text-foreground/90">
                  {section.title}
                </h3>
              )}
              {section.body.map((paragraph, i) => (
                <p
                  key={i}
                  className="mt-3 text-sm leading-6 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>

        <aside className="hidden md:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <TableOfContents items={sections} activeId={activeId} />
          </div>
        </aside>
      </div>
    </div>
  );
}
