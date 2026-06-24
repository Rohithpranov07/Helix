import type { ReactNode } from "react";
import { Activity, FlaskConical, GitPullRequest, Zap } from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const INK = "#18181b";
const ACCENT = { emerald: "#059669", red: "#dc2626", blue: "#2563eb", amber: "#d97706" };

interface TabContent {
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  imageSrc: string;
  imageAlt: string;
}

interface Tab {
  value: string;
  icon: ReactNode;
  label: string;
  content: TabContent;
}

interface Feature108Props {
  badge?: string;
  heading?: string;
  description?: string;
  tabs?: Tab[];
}

// Default content — the Resurrection Reflex pipeline: detect → diagnose → validate → heal.
const defaultTabs: Tab[] = [
  {
    value: "detect",
    icon: <Activity className="h-auto w-4 shrink-0" />,
    label: "Detect",
    content: {
      badge: "Always Watching",
      title: "Every deployment, watched in real time.",
      description:
        "Railway deployment logs and runtime errors are monitored continuously. The moment a failure signature appears, the Resurrection Reflex wakes up.",
      buttonText: "View Activity Log",
      imageSrc: "/dash-reflex.jpg",
      imageAlt: "HELIX activity stream screenshot",
    },
  },
  {
    value: "diagnose",
    icon: <Zap className="h-auto w-4 shrink-0" />,
    label: "Diagnose",
    content: {
      badge: "Root-Cause Tracing",
      title: "Find the exact line that broke production.",
      description:
        "Qwen3.6-27B reconstructs the causal chain from logs, the failing deploy, and the intent genome — pinpointing the exact commit and code path responsible.",
      buttonText: "See Causal Chain",
      imageSrc: "/dash-genome.jpg",
      imageAlt: "HELIX genome causal chain screenshot",
    },
  },
  {
    value: "validate",
    icon: <FlaskConical className="h-auto w-4 shrink-0" />,
    label: "Validate",
    content: {
      badge: "Shadow-Tested",
      title: "Proven safe before it ever ships.",
      description:
        "The candidate patch never touches production. It's replayed against a disposable shadow clone until the proof returns a clean verdict: promote.",
      buttonText: "View Shadow Proofs",
      imageSrc: "/dash-shadow.jpg",
      imageAlt: "HELIX shadow proof screenshot",
    },
  },
  {
    value: "heal",
    icon: <GitPullRequest className="h-auto w-4 shrink-0" />,
    label: "Heal",
    content: {
      badge: "Permanent Memory",
      title: "PR shipped, antibody minted.",
      description:
        "Once promoted, HELIX opens a pull request with the fix and mints a permanent antibody — so this exact failure can never take the system down again.",
      buttonText: "View Open PRs",
      imageSrc: "/dash-antibody.jpg",
      imageAlt: "HELIX antibody library screenshot",
    },
  },
];

const Feature108 = ({
  badge = "Nervous System",
  heading = "How the Resurrection Reflex Works",
  description = "From the moment a deployment fails to the moment a fix ships — fully autonomous, fully proven.",
  tabs = defaultTabs,
}: Feature108Props) => {
  return (
    <section className="py-16">
      <div className="container mx-auto">
        <motion.div
          className="flex flex-col items-center gap-4 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge variant="outline" className="border-2 px-3 py-1 font-extrabold uppercase tracking-widest" style={{ borderColor: INK, color: INK }}>
            {badge}
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight md:text-4xl" style={{ color: INK }}>
            {heading}
          </h2>
          <p className="font-semibold" style={{ color: `${INK}88` }}>{description}</p>
        </motion.div>
        <Tabs defaultValue={tabs[0]?.value ?? ""} className="mt-8">
          <TabsList className="container flex h-auto flex-col items-center justify-center gap-3 bg-transparent p-0 sm:flex-row md:gap-4">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-2 rounded-full border-2 border-[#18181b] px-4 py-2 text-sm font-bold text-[#18181b] transition-colors duration-200",
                  "data-[state=active]:bg-[#18181b] data-[state=active]:text-white data-[state=active]:shadow-none",
                )}
              >
                {tab.icon} {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <motion.div
            className="mx-auto mt-8 max-w-7xl rounded-2xl border-[3px] p-6 lg:p-12"
            style={{ borderColor: INK, background: "#fff", boxShadow: `8px 8px 0px ${INK}` }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            whileHover={{ y: -3, boxShadow: `11px 11px 0px ${INK}` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="grid place-items-center gap-12 lg:grid-cols-2 lg:gap-10"
              >
                <div className="flex flex-col gap-5">
                  <Badge variant="outline" className="w-fit border-2 font-extrabold uppercase tracking-widest" style={{ borderColor: ACCENT.amber, color: ACCENT.amber }}>
                    {tab.content.badge}
                  </Badge>
                  <h3 className="text-3xl font-bold tracking-tight lg:text-4xl" style={{ color: INK }}>
                    {tab.content.title}
                  </h3>
                  <p className="font-semibold lg:text-lg" style={{ color: `${INK}99` }}>
                    {tab.content.description}
                  </p>
                  <Button
                    className="mt-2.5 w-fit gap-2 rounded-full border-2 font-bold"
                    size="lg"
                    style={{ borderColor: INK, background: ACCENT.amber, color: "#fff", boxShadow: `4px 4px 0px ${INK}` }}
                  >
                    {tab.content.buttonText}
                  </Button>
                </div>
                <motion.img
                  src={tab.content.imageSrc}
                  alt={tab.content.imageAlt}
                  className="aspect-4/3 w-full rounded-xl border-2 object-cover"
                  style={{ borderColor: INK, boxShadow: `6px 6px 0px ${INK}` }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </TabsContent>
            ))}
          </motion.div>
        </Tabs>
      </div>
    </section>
  );
};

export { Feature108 };
