import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";
import { Component as ClubHero } from "@/components/ui/hero";
import { HelixThread } from "@/components/ui/helix-thread";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { QuickStartGuide } from "@/components/ui/quick-start-guide";
import { OrganTabsSection } from "@/components/ui/organ-tabs-section";
import { HoverPreview } from "@/components/ui/hover-preview";
import { HelixOrganCarousel } from "@/components/ui/helix-organ-carousel";
import FAQsTwo from "@/components/ui/faq-two";
import { HelixOutro } from "@/components/ui/helix-outro";

interface Props {
  searchParams: Promise<{ github_connected?: string; error?: string }>;
}

export default async function ChatPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="min-h-screen w-full bg-[#0038FF] text-white">
      <ClubHero />

      <ScrollReveal className="flex justify-center items-start w-full">
        <RuixenMoonChat
          githubConnected={params.github_connected}
          error={params.error}
        />
      </ScrollReveal>

      <QuickStartGuide />

      {/* One continuous thread enters at "Pick an organ" and tucks behind the
          closing "helix" wordmark block */}
      <HelixThread>
        <OrganTabsSection />

        <ScrollReveal className="w-full">
          <HoverPreview />
        </ScrollReveal>

        <HelixOrganCarousel />
        <FAQsTwo />
        <HelixOutro />
      </HelixThread>
    </main>
  );
}
