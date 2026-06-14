import { OnboardingDialog } from "@/components/ui/onboarding-dialog";

interface Props {
  searchParams: Promise<{ repo?: string }>;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const { repo } = await searchParams;
  return (
    <main className="min-h-screen w-full bg-[#0d0f1a]">
      <OnboardingDialog repoName={repo} onComplete={undefined} />
    </main>
  );
}
