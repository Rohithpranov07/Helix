'use client'

import React, { useState, useRef, useEffect } from 'react'
import { 
  Plus, FileCode,
  ChevronDown, Check, Sparkles, Zap, Brain,
  SendHorizontal
} from 'lucide-react'

// TYPES
interface Model {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  badge?: string
}

// GITHUB ICON
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

// MODEL SELECTOR
const models: Model[] = [
  { id: 'deep-scan', name: 'Deep Scan', description: 'Comprehensive genome mapping', icon: <Brain className="size-4 text-purple-400" />, badge: 'Pro' },
  { id: 'fast-scan', name: 'Fast Scan', description: 'Quick drift detection', icon: <Zap className="size-4 text-emerald-400" /> }
]

function ModelSelector({ selected, onSelect }: { selected: Model, onSelect: (m: Model) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (model: Model) => {
    onSelect(model)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 active:scale-95"
      >
        {selected.icon}
        <span>{selected.name}</span>
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-50 min-w-[220px] bg-white/95 backdrop-blur-xl border border-black/10 rounded-xl shadow-[0_18px_40px_-20px_rgba(15,23,42,0.3)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="p-1.5">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9aa0a6]">
                Select Mode
              </div>
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all duration-150 ${
                    selected.id === model.id ? 'bg-black/[0.06] text-[#1d1d1f]' : 'text-[#475569] hover:bg-black/5 hover:text-[#1d1d1f]'
                  }`}
                >
                  <div className="flex-shrink-0">{model.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      {model.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          model.badge === 'Pro' ? 'bg-purple-500/15 text-purple-600' : 'bg-blue-500/15 text-blue-600'
                        }`}>
                          {model.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#9aa0a6]">{model.description}</span>
                  </div>
                  {selected.id === model.id && <Check className="size-4 text-blue-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ChatInput({ value, onChange, onSend, placeholder, actionLabel = "Connect", isProcessing = false, onUploadIntentDoc }: {
  value: string;
  onChange: (val: string) => void;
  onSend?: ((modelId: string) => void) | undefined;
  placeholder?: string | undefined;
  actionLabel?: string | undefined;
  isProcessing?: boolean | undefined;
  onUploadIntentDoc?: ((content: string) => void) | undefined;
}) {
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model>(models[0]!)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isProcessing) {
        onSend?.(selectedModel.id)
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        onUploadIntentDoc?.(e.target.result)
        setShowAttachMenu(false)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  return (
    <div className="relative w-full max-w-[680px] mx-auto">
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-black/[0.06] to-transparent pointer-events-none" />
      <div className="relative rounded-2xl bg-white/80 backdrop-blur-xl ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.25)]">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent text-[15px] text-[#1d1d1f] placeholder-[#9aa0a6] px-5 pt-5 pb-3 focus:outline-none min-h-[80px] max-h-[200px]"
            style={{ height: '80px' }}
            disabled={isProcessing}
          />
        </div>

        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                disabled={isProcessing}
                className="flex items-center justify-center size-8 rounded-full bg-black/[0.05] hover:bg-black/[0.09] text-[#6e6e73] hover:text-[#1d1d1f] transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                <Plus className={`size-4 transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''}`} />
              </button>

              {showAttachMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-2 z-50 bg-white/95 backdrop-blur-xl border border-black/10 rounded-xl shadow-[0_18px_40px_-20px_rgba(15,23,42,0.3)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-1.5 min-w-[180px]">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#475569] hover:bg-black/5 hover:text-[#1d1d1f] transition-all duration-150">
                        <FileCode className="size-4" />
                        <span className="text-sm">Upload intent doc</span>
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".md,.txt,.json,.csv" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSend?.(selectedModel.id)}
              disabled={!value.trim() || isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#1488fc] hover:bg-[#1a94ff] text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-[0_0_20px_rgba(20,136,252,0.3)]"
            >
              {isProcessing ? (
                <>
                  <span className="hidden sm:inline">Processing...</span>
                  <div className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">{actionLabel}</span>
                  <SendHorizontal className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Ray Background — light cream ambient with a soft blue genome glow
function RayBackground() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
      {/* Warm cream canvas with accent blooms, matching the dashboard home */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(50% 40% at 50% 0%, rgba(56,189,250,0.28) 0%, transparent 60%)",
            "radial-gradient(40% 40% at 4% 4%, rgba(52,211,153,0.16) 0%, transparent 60%)",
            "radial-gradient(40% 40% at 96% 6%, rgba(167,139,250,0.16) 0%, transparent 60%)",
            "linear-gradient(180deg, #fbf6ec 0%, #f6efe2 55%, #efe5d3 100%)",
          ].join(", "),
        }}
      />
      {/* Whisper grid for depth, masked to fade out */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, #000 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, #000 0%, transparent 80%)",
        }}
      />
    </div>
  )
}

// MAIN BOLT CHAT COMPONENT
interface BoltChatProps {
  repoValue: string;
  onRepoChange: (v: string) => void;
  onConnect: (modelId: string) => void;
  connectedRepos: Array<{ owner: string, repo: string }>;
  onSelectRepo: (owner: string, repo: string) => void;
  selectedConnKey?: string;
  onAction?: (action: 'index' | 'detect' | 'refresh') => void;
  actionStates?: { indexing: boolean, detecting: boolean };
  isConnected?: boolean;
  onUploadIntentDoc?: (content: string) => void;
  children?: React.ReactNode;
}

export function GenomeConnectUI({
  repoValue,
  onRepoChange,
  onConnect,
  connectedRepos,
  onSelectRepo,
  selectedConnKey,
  onAction,
  actionStates,
  isConnected,
  onUploadIntentDoc,
  children
}: BoltChatProps) {
  const isProcessing = Boolean(actionStates?.indexing || actionStates?.detecting);

  return (
    <div className="relative flex flex-col items-center min-h-screen w-full overflow-hidden -mt-10 pt-16 pb-20" style={{ backgroundColor: "#f6efe2" }}>
      <RayBackground />
      
      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-start w-full h-full px-4 pt-20 sm:pt-32">
        {/* Title section */}
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-4xl sm:text-6xl font-bold text-[#1d1d1f] tracking-tight mb-4">
            Map your{' '}
            <span className="bg-gradient-to-b from-[#38bdf8] via-[#2f8fe0] to-[#1d4ed8] bg-clip-text text-transparent italic">
              genome
            </span>
            {' '}today
          </h1>
          <p className="text-base font-semibold sm:text-lg text-[#6e6e73]">Connect a GitHub URL to monitor its genetic drift.</p>
        </div>

        {/* Chat input */}
        <div className="w-full max-w-[700px] mb-8 sm:mb-10">
          <ChatInput 
            value={repoValue} 
            onChange={onRepoChange} 
            onSend={(modelId) => onConnect(modelId)} 
            placeholder="https://github.com/octocat/my-repo" 
            actionLabel={isConnected ? "Run" : "Connect"}
            isProcessing={isProcessing}
            onUploadIntentDoc={onUploadIntentDoc}
          />
        </div>

        {/* Connected Repos Suggestions */}
        {connectedRepos.length > 0 && (
          <div className="flex flex-col items-center gap-5 w-full max-w-[700px] mb-4">
            <span className="text-sm font-semibold text-[#6e6e73] tracking-widest uppercase mb-2">Connected Repositories</span>
            <div className="flex flex-col gap-3 w-full max-w-sm">
              {connectedRepos.slice(0, 3).map((c) => {
                const key = `${c.owner}/${c.repo}`;
                const isSelected = selectedConnKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelectRepo(c.owner, c.repo)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 w-full ${
                      isSelected
                        ? 'bg-[#1488fc]/10 border-[#1488fc]/40 text-[#1d1d1f] shadow-[0_0_24px_-8px_rgba(20,136,252,0.35)]'
                        : 'bg-white/70 border-black/[0.06] text-[#475569] hover:bg-white hover:text-[#1d1d1f]'
                    }`}
                  >
                    <GithubIcon className="size-4 opacity-70" />
                    <span className="text-sm font-medium">{key}</span>
                    {isSelected && <Check className="size-4 ml-auto text-[#1488fc]" />}
                  </button>
                )
              })}
            </div>

            {/* Actions for selected repo */}
            {selectedConnKey && onAction && actionStates && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => onAction('index')}
                  disabled={actionStates.indexing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-white/80 hover:bg-white text-[#1d1d1f] border border-black/10 shadow-sm transition-all"
                >
                  <Brain className="size-3" />
                  {actionStates.indexing ? "Indexing…" : "Index Repository"}
                </button>
                <button
                  onClick={() => onAction('detect')}
                  disabled={actionStates.detecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 border border-emerald-500/25 transition-all"
                >
                  <Sparkles className="size-3" />
                  {actionStates.detecting ? "Detecting…" : "Detect Drift"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="w-full mt-12 max-w-6xl">
          {children}
        </div>
      </div>
    </div>
  )
}
