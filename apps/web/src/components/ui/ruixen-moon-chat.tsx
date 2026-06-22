"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { OnboardingDialog } from "@/components/ui/onboarding-dialog";
import Link from "next/link";
import {
  GitBranch,
  Paperclip,
  ArrowUpIcon,
  ArrowRight,
  Dna,
  ShieldCheck,
  Activity,
  Flame,
  X,
  FileText,
  Loader2,
} from "lucide-react";

const HEADLINE_SHADOW =
  "1px 1px 0 #001A99, 2px 2px 0 #001A99, 3px 3px 0 #001A99, 4px 4px 0 #001A99, 5px 5px 0 #001A99, 6px 6px 0 #001A99";

const ArrowAccentLeft = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full text-[#CCFF00] stroke-current overflow-visible" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10,90 C 10,40 40,20 60,50 C 70,65 80,75 95,70" />
    <path d="M80,55 L95,70 L85,85" />
  </svg>
);

const ArrowAccentRight = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full text-[#CCFF00] stroke-current overflow-visible" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M90,10 C 80,60 60,80 40,60 C 20,40 40,20 60,30 C 80,40 70,70 50,80" />
    <path d="M65,75 L50,80 L55,65" />
  </svg>
);

interface FloatingStatusCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  stat: string;
  rotate: number;
  duration: number;
  delay?: number;
  className: string;
}

function FloatingStatusCard({ icon, iconBg, label, stat, rotate, duration, delay = 0, className }: FloatingStatusCardProps) {
  return (
    <motion.div
      animate={{ y: [0, -14, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      className={cn("absolute z-0 pointer-events-none hidden lg:block", className)}
    >
      <div
        className="w-36 bg-white/10 backdrop-blur-md border border-white/25 rounded-[1.5rem] p-4 flex flex-col items-center text-center shadow-2xl"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-3 border-2 border-white/40", iconBg)}>
          {icon}
        </div>
        <p className="font-bold text-xs text-white">{label}</p>
        <p className="text-[10px] text-white/70 mt-1">{stat}</p>
      </div>
    </motion.div>
  );
}

const LiveBadge = () => (
  <Link
    href="/dashboard"
    className="hidden md:flex absolute bottom-[6%] right-[5%] z-20 w-24 h-24 bg-[#CCFF00] rounded-full items-center justify-center shadow-xl rotate-12 hover:scale-105 transition-transform cursor-pointer border-[3px] border-black/5"
  >
    <div className="absolute inset-1 animate-[spin_10s_linear_infinite]">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <path id="chatCirclePath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
        <text className="text-[10px] font-black tracking-[0.18em] uppercase" fill="black">
          <textPath href="#chatCirclePath" startOffset="0%">
            OPEN DASHBOARD • OPEN DASHBOARD •
          </textPath>
        </text>
      </svg>
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <ArrowRight className="w-7 h-7 text-black" strokeWidth={2.5} />
    </div>
  </Link>
);

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity),
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    if (textareaRef.current)
      textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

function stripGitSuffix(s: string): string {
  return s.replace(/\.git$/, "");
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/,
  );
  if (urlMatch)
    return { owner: urlMatch[1]!, repo: stripGitSuffix(urlMatch[2]!) };
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch)
    return { owner: shortMatch[1]!, repo: stripGitSuffix(shortMatch[2]!) };
  return null;
}

interface AttachedFile {
  name: string;
  size: number;
  type: string;
}

type ChatState =
  | { stage: "idle" }
  | { stage: "error"; message: string }
  | { stage: "repo-parsed"; owner: string; repo: string }
  | { stage: "connecting"; owner: string; repo: string }
  | { stage: "connected"; owner: string; repo: string };

interface Props {
  githubConnected: string | undefined;
  error: string | undefined;
}

export default function RuixenMoonChat({ githubConnected, error }: Props) {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [state, setState] = useState<ChatState>({ stage: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 48,
    maxHeight: 150,
  });

  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [connectedRepo, setConnectedRepo] = React.useState<string | undefined>(undefined);

  // Handle OAuth callback on mount — clear params from URL immediately after reading
  useEffect(() => {
    if (githubConnected) {
      const [owner = "", repo = ""] = githubConnected.split("/");
      setState({ stage: "connected", owner, repo });
      setConnectedRepo(githubConnected);
      window.history.replaceState(null, "", "/chat");
      setShowOnboarding(true);
    }
    if (error) {
      setState({ stage: "error", message: error });
      window.history.replaceState(null, "", "/chat");
    }
  }, [githubConnected, error, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed && files.length === 0) return;

    const parsed = trimmed ? parseGitHubUrl(trimmed) : null;

    if (parsed) {
      setState({ stage: "repo-parsed", owner: parsed.owner, repo: parsed.repo });
      setMessage("");
      setFiles([]);
      adjustHeight(true);
    } else {
      // No valid URL — nudge, but keep content so user can edit
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConnectGitHub = () => {
    if (state.stage !== "repo-parsed") return;
    const { owner, repo } = state;
    setState({ stage: "connecting", owner, repo });
    window.location.href = `/api/auth/github?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
  };

  const handleQuickAction = (text: string) => {
    setMessage(text);
    textareaRef.current?.focus();
  };

  const isIdle = state.stage === "idle" || state.stage === "error";
  const isDisabled = state.stage === "connecting" || state.stage === "connected";

  const canSend =
    (message.trim().length > 0 || files.length > 0) && !isDisabled;

  return (
    <div className="relative w-full h-screen bg-[#0038FF] flex flex-col items-center overflow-hidden selection:bg-[#CCFF00] selection:text-black">
      {/* Background grid — matches the ClubHero billboard aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none z-0" />

      {/* Decorative hand-drawn arrows */}
      <div className="absolute top-[10%] left-[6%] w-20 h-20 md:w-28 md:h-28 opacity-70 pointer-events-none z-0 hidden sm:block">
        <ArrowAccentLeft />
      </div>
      <div className="absolute bottom-[14%] right-[6%] w-20 h-20 md:w-28 md:h-28 opacity-70 pointer-events-none z-0 hidden sm:block">
        <ArrowAccentRight />
      </div>

      {/* Floating organ status cards */}
      <FloatingStatusCard
        icon={<Dna className="w-6 h-6 text-black" strokeWidth={1.5} />}
        iconBg="bg-[#7db8ff]"
        label="genome.helix"
        stat="98% aligned"
        rotate={-8}
        duration={5}
        className="top-[18%] left-[4%]"
      />
      <FloatingStatusCard
        icon={<ShieldCheck className="w-6 h-6 text-white" strokeWidth={1.5} />}
        iconBg="bg-[#2C3E50]"
        label="immune.helix"
        stat="0 threats"
        rotate={8}
        duration={6}
        delay={1}
        className="top-[20%] right-[4%]"
      />
      <FloatingStatusCard
        icon={<Activity className="w-6 h-6 text-black" strokeWidth={1.5} />}
        iconBg="bg-[#FF8A65]"
        label="vitals.helix"
        stat="entropy nominal"
        rotate={-6}
        duration={7}
        delay={0.5}
        className="bottom-[16%] left-[5%]"
      />

      {/* Top status pill */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/80 font-semibold">
          System Online
        </span>
      </motion.div>

      {/* Spinning dashboard badge */}
      <LiveBadge />

      {/* Onboarding dialog — floats over this same background */}
      {showOnboarding && (
        <OnboardingDialog
          repoName={connectedRepo}
          onComplete={() => router.push("/dashboard")}
        />
      )}

      {/* ── Centre section (flex-1) ── */}
      <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {/* IDLE / ERROR */}
          {isIdle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-center"
            >
              <h1
                className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white"
                style={{ fontFamily: '"Arial Black", Impact, sans-serif', textShadow: HEADLINE_SHADOW }}
              >
                HELIX
              </h1>
              <p className="mt-4 text-white/80 text-sm md:text-base max-w-md mx-auto font-medium">
                Attach your repo —{" "}
                <span className="text-[#CCFF00] font-black">HELIX</span> will
                secure it, heal it, and keep it alive.
              </p>
              {state.stage === "error" && (
                <p className="mt-3 text-red-200 text-sm max-w-sm mx-auto">
                  {state.message}
                </p>
              )}
            </motion.div>
          )}

          {/* REPO PARSED — ask for GitHub auth */}
          {(state.stage === "repo-parsed" || state.stage === "connecting") && (
            <motion.div
              key="repo"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-center flex flex-col items-center gap-5"
            >
              <div>
                <p className="text-xs text-white/60 uppercase tracking-widest mb-1 font-bold">
                  Repository detected
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                  {state.owner}/{state.repo}
                </h2>
                <p className="mt-2 text-white/70 text-sm max-w-sm mx-auto">
                  HELIX needs GitHub access to read your code, detect drift, and write healing patches.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: state.stage === "connecting" ? 1 : 1.05 }}
                whileTap={{ scale: state.stage === "connecting" ? 1 : 0.96 }}
                onClick={handleConnectGitHub}
                disabled={state.stage === "connecting"}
                className="flex items-center gap-2 bg-[#CCFF00] hover:brightness-95 text-black px-6 py-3 rounded-full font-black text-sm uppercase tracking-wide shadow-lg disabled:opacity-60 transition-[filter]"
              >
                {state.stage === "connecting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to GitHub…
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    Authorize GitHub Access
                  </>
                )}
              </motion.button>

              <p className="text-xs text-white/50">
                Requests <span className="text-white/80 font-mono">repo</span> scope only — read code + branch/PR creation for patches.
              </p>
            </motion.div>
          )}

          {/* CONNECTED — onboarding dialog handles the visual, nothing shown here */}
          {state.stage === "connected" && <motion.div key="connected" />}
        </AnimatePresence>
      </div>

      {/* ── Input section ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-3xl mb-[20vh] px-4"
      >
        {/* Attached files strip */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-[#001A99]/60 border border-white/20 rounded-full px-3 py-1.5 text-xs text-white/90"
              >
                <FileText className="w-3 h-3 text-white/70" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-white/60 hover:text-[#CCFF00] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative bg-[#1A0B3D]/70 backdrop-blur-md rounded-[1.75rem] border border-[#B084FF]/30 focus-within:border-[#CCFF00]/70 shadow-2xl transition-colors">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isIdle
                ? "Paste your GitHub repo URL — e.g. github.com/you/myapp"
                : "Repository detected above ↑"
            }
            disabled={isDisabled || !isIdle}
            className={cn(
              "w-full px-5 py-4 resize-none border-none",
              "bg-transparent text-white text-sm",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-white/50 min-h-[48px]",
              "disabled:opacity-50",
            )}
            style={{ overflow: "hidden" }}
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDisabled || !isIdle}
                className="text-white hover:bg-white/10 disabled:opacity-40 rounded-full"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>

            <motion.button
              whileHover={canSend ? { scale: 1.08 } : {}}
              whileTap={canSend ? { scale: 0.94 } : {}}
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full transition-colors",
                canSend
                  ? "bg-[#CCFF00] text-black hover:brightness-95"
                  : "bg-white/10 text-white/40 cursor-not-allowed",
              )}
            >
              <ArrowUpIcon className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </motion.button>
          </div>
        </div>

        {/* Quick Actions — only in idle */}
        {isIdle && (
          <div className="flex items-center justify-center flex-wrap gap-3 mt-6">
            <QuickAction
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Analyze Security"
              accent="#7db8ff"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Dna className="w-4 h-4" />}
              label="Genome Drift"
              accent="#CCFF00"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Activity className="w-4 h-4" />}
              label="Immunity Report"
              accent="#FF8A65"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Flame className="w-4 h-4" />}
              label="Entropy Check"
              accent="#FFD166"
              onClick={() => handleQuickAction("github.com/")}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onClick?: () => void;
}

function QuickAction({ icon, label, accent, onClick }: QuickActionProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{ color: accent }}
      className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-white/90 hover:bg-white/20 transition-colors"
    >
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-xs font-semibold text-white/90">{label}</span>
    </motion.button>
  );
}
