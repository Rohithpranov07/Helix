"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";

const ACCENTS = ["#CCFF00", "#7db8ff", "#FF8A65", "#FFD166"];

export default function FAQsTwo() {
  const faqItems = [
    {
      id: "item-1",
      question: "What exactly does HELIX watch for?",
      answer:
        "Intent drift, code drift, vulnerabilities, and production failures — HELIX treats all four as one phenomenon: divergence over time. Genome catches it before it ships, Immune System neutralizes it on sight, and Shadow proves every fix before it touches production.",
    },
    {
      id: "item-2",
      question: "Does HELIX write code directly to my repo?",
      answer:
        'No write ever reaches your real codebase without a Shadow proof. Every healing patch runs in an isolated twin first — only a verdict of "promote" lets it open a branch or PR against your repo.',
    },
    {
      id: "item-3",
      question: "What access does HELIX need to GitHub?",
      answer:
        "Just the repo scope — enough to read your code and open branches/PRs for healing patches. Nothing more is requested during authorization.",
    },
    {
      id: "item-4",
      question: "How fast is the first scan?",
      answer:
        "The moment your repo connects, HELIX runs a Genome index and drift check automatically — so you get a real picture of intent-vs-code alignment before you've touched the dashboard.",
    },
    {
      id: "item-5",
      question: "Can I see what HELIX changed and why?",
      answer:
        "Every organ action writes an auditable record — incidents, antibody matches, entropy shifts, and Shadow proofs are all logged so you can trace exactly what happened and why it was safe to ship.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0038FF] py-16 text-white md:py-24">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-4 md:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl">
            Frequently Asked <span className="text-[#CCFF00]">Questions</span>
          </h2>
          <p className="mt-4 text-balance text-white/60">
            Everything you'd ask before letting an autonomous organism touch
            your production code.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-xl">
          <Accordion
            type="single"
            collapsible
            className="w-full rounded-2xl border border-[#CCFF00]/40 bg-white/5 px-8 py-3 shadow-[0_0_45px_-10px_rgba(204,255,0,0.5)] ring-4 ring-[#CCFF00]/10 backdrop-blur-md"
          >
            {faqItems.map((item, index) => {
              const accent = ACCENTS[index % ACCENTS.length];
              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-dashed border-[#CCFF00]/15"
                >
                  <AccordionTrigger className="cursor-pointer text-base text-white hover:no-underline">
                    <span className="flex items-baseline gap-3">
                      <span
                        className="font-mono text-xs tracking-[0.2em]"
                        style={{ color: accent }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {item.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="pl-9 text-base text-white/60">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <p className="mt-6 px-8 text-white/60">
            Can't find what you're looking for? Contact our{" "}
            <Link
              href="#"
              className="font-medium text-[#CCFF00] hover:underline"
            >
              customer support team
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
