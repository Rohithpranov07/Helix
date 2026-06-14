import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";

interface Props {
  searchParams: Promise<{ github_connected?: string; error?: string }>;
}

export default async function ChatPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="min-h-screen w-full bg-black text-white">
      <section className="flex justify-center items-start w-full">
        <RuixenMoonChat
          githubConnected={params.github_connected}
          error={params.error}
        />
      </section>
    </main>
  );
}
