"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { OnboardingDialog } from "@/components/ui/onboarding-dialog";
import {
  GitBranch,
  Paperclip,
  ArrowUpIcon,
  Dna,
  ShieldCheck,
  Activity,
  Flame,
  X,
  FileText,
  Loader2,
} from "lucide-react";

const BG_URL =
  "https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png";

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
  ReactDOM.preload(BG_URL, { as: "image" });
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
    <div
      className="relative w-full h-screen bg-cover bg-center flex flex-col items-center"
      style={{
        backgroundImage: `url('${BG_URL}')`,
        backgroundAttachment: "fixed",
        backgroundColor: "#0d0f1a",
      }}
    >
      {/* Onboarding dialog — floats over this same background */}
      {showOnboarding && (
        <OnboardingDialog
          repoName={connectedRepo}
          onComplete={() => router.push("/dashboard")}
        />
      )}
      {/* ── Centre section (flex-1) — same slot as original title ── */}
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        {/* IDLE / ERROR */}
        {(state.stage === "idle" || state.stage === "error") && (
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-white drop-shadow-sm">
              HELIX
            </h1>
            <p className="mt-2 text-neutral-200">
              Attach your repo — HELIX will secure it, heal it, and keep it alive.
            </p>
            {state.stage === "error" && (
              <p className="mt-3 text-red-400 text-sm max-w-sm">
                {state.message}
              </p>
            )}
          </div>
        )}

        {/* REPO PARSED — ask for GitHub auth */}
        {(state.stage === "repo-parsed" || state.stage === "connecting") && (
          <div className="text-center flex flex-col items-center gap-5">
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                Repository detected
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {state.owner}/{state.repo}
              </h2>
              <p className="mt-2 text-neutral-400 text-sm max-w-sm">
                HELIX needs GitHub access to read your code, detect drift, and write healing patches.
              </p>
            </div>

            <Button
              onClick={handleConnectGitHub}
              disabled={state.stage === "connecting"}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
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
            </Button>

            <p className="text-xs text-neutral-600">
              Requests <span className="text-neutral-400 font-mono">repo</span> scope only — read code + branch/PR creation for patches.
            </p>
          </div>
        )}

        {/* CONNECTED — onboarding dialog handles the visual, nothing shown here */}
        {state.stage === "connected" && null}
      </div>

      {/* ── Input section — exact same position as original (mb-[20vh]) ── */}
      <div className="w-full max-w-3xl mb-[20vh]">
        {/* Attached files strip */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-black/60 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300"
              >
                <FileText className="w-3 h-3 text-neutral-400" />
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-neutral-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700 focus-within:border-green-500/40 transition-colors">
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
              "w-full px-4 py-3 resize-none border-none",
              "bg-transparent text-white text-sm",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-neutral-400 min-h-[48px]",
              "disabled:opacity-50",
            )}
            style={{ overflow: "hidden" }}
          />

          <div className="flex items-center justify-between p-3">
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
                className="text-white hover:bg-neutral-700 disabled:opacity-40"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>

            <Button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                canSend
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-neutral-700 text-neutral-400 cursor-not-allowed",
              )}
            >
              <ArrowUpIcon className="w-4 h-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>

        {/* Quick Actions — only in idle, same layout as original */}
        {isIdle && (
          <div className="flex items-center justify-center flex-wrap gap-3 mt-6">
            <QuickAction
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Analyze Security"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Dna className="w-4 h-4" />}
              label="Genome Drift"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Activity className="w-4 h-4" />}
              label="Immunity Report"
              onClick={() => handleQuickAction("github.com/")}
            />
            <QuickAction
              icon={<Flame className="w-4 h-4" />}
              label="Entropy Check"
              onClick={() => handleQuickAction("github.com/")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function QuickAction({ icon, label, onClick }: QuickActionProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border-neutral-700 bg-black/50 text-neutral-300 hover:text-white hover:bg-neutral-700"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
