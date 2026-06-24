'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from '@/lib/utils'

export type ScanMethod = 'SAST' | 'DAST' | 'SECRETS' | 'FULL' | 'CUSTOM'

export interface Parameter {
  id: string
  key: string
  value: string
}

export interface ScanConfig {
  repoId: string
  method: ScanMethod
  rulesets: Parameter[]
  ignorePaths: Parameter[]
  branches: Parameter[]
  custom: Parameter[]
  rawResponse?: {
    status?: string
    data?: unknown
    error?: string
  }
}

export interface APITestResponse {
  status?: string
  data?: unknown
  error?: string
}

export interface CleanScanConfig {
  repoId: string
  method: string
  rulesets?: Omit<Parameter, 'id'>[]
  ignorePaths?: Omit<Parameter, 'id'>[]
  branches?: Omit<Parameter, 'id'>[]
  custom?: Omit<Parameter, 'id'>[]
}

export interface ScanPreset {
  name: string
  config: Omit<ScanConfig, 'rawResponse'>
}

function titleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

type TabType = 'rulesets' | 'ignorePaths' | 'branches' | 'custom'

interface APIPlaygroundProps {
  config?: ScanConfig
  onConfigChange?: (config: ScanConfig) => void
  onTest?: (config: ScanConfig) => Promise<APITestResponse>
  connections: string[] // List of "owner/repo" strings
  scanning?: boolean
}

export function APIPlayground({
  config: initialConfig,
  onConfigChange,
  onTest,
  connections = [],
  scanning = false
}: APIPlaygroundProps) {
  const [activeTab, setActiveTab] = useState<TabType>('rulesets')
  const [config, setConfig] = useState<ScanConfig>(initialConfig || {
    repoId: '',
    method: 'SAST',
    rulesets: [],
    ignorePaths: [],
    branches: [],
    custom: [],
    rawResponse: {}
  })

  useEffect(() => {
    if (onConfigChange) {
      onConfigChange(config)
    }
  }, [config, onConfigChange])

  const updateConfig = <K extends keyof ScanConfig>(key: K, value: ScanConfig[K]) => {
    setConfig(prev => {
      return { ...prev, [key]: value }
    })
  }

  const activeTabMap =
    activeTab === 'rulesets' ? config.rulesets :
    activeTab === 'ignorePaths' ? config.ignorePaths :
    activeTab === 'branches' ? config.branches :
    activeTab === 'custom' ? config.custom : []

  const setRulesets = (rulesets: Parameter[]) => updateConfig('rulesets', rulesets)
  const setIgnorePaths = (ignorePaths: Parameter[]) => updateConfig('ignorePaths', ignorePaths)
  const setBranches = (branches: Parameter[]) => updateConfig('branches', branches)
  const setCustom = (custom: Parameter[]) => updateConfig('custom', custom)

  const map = { rulesets: setRulesets, ignorePaths: setIgnorePaths, branches: setBranches, custom: setCustom }

  const updateActiveTabMapItem = (type: keyof typeof map, id: string, field: 'key' | 'value', value: string): void => {
    const updatedSettingsConfig = config[type]?.map((item: Parameter) =>
      item.id === id ? { ...item, [field]: value } : item
    )
    map[type](updatedSettingsConfig)
  }

  const addActiveTabMapItem = (type: keyof typeof map) => {
    const newItem: Parameter = {
      id: crypto.randomUUID(),
      value: '',
      key: ''
    }
    const updatedItems = [...(config[type] || []), newItem]
    map[type](updatedItems)
  }

  const removeActiveTabMapItem = (type: keyof typeof map, itemId: string) => {
    const filteredItems = config[type]?.filter((item: Parameter) => item.id !== itemId) || []
    map[type](filteredItems)
  }

  const testApi = async () => {
    if (!onTest) return
    try {
      const response = await onTest(config)
      updateConfig('rawResponse', {
        status: response.status || "Complete",
        data: response.data || response,
        ...(response.error !== undefined ? { error: response.error as string } : {})
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      updateConfig('rawResponse', {
        error: message
      })
    }
  }

  const applyExampleConfig = (example: 'owasp' | 'secrets' | 'fast') => {
    const preset = example === 'owasp' ? DUMMY_OWASP_CONFIG :
                  example === 'secrets' ? DUMMY_SECRETS_CONFIG :
                  DUMMY_FAST_CONFIG

    setConfig({ ...preset.config, repoId: config.repoId })
  }

  // --- Animation State for Scanning Logs ---
  const [logs, setLogs] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scanning) {
      setLogs([]);
      setElapsed(0);
      return;
    }

    const PHASE1_LOGS = [
      "> Initializing secure sandbox...",
      "> Mounting GitHub repository volume...",
      "> Fetching branch metadata...",
      "> Extracting deep dependency graph...",
      "> Running pattern match on AST...",
      "> Analyzing control flow paths...",
      "> Taint analysis in progress...",
      "> Checking for hardcoded secrets...",
      "> Scanning for SQL injection vectors...",
      "> Evaluating cross-site scripting risks...",
      "> Compiling vulnerability report...",
      "> Finalizing analysis...",
    ];

    const PHASE2_LOGS = [
      "> Running Gemini wide-context analysis...",
      "> Deep-scanning control flow paths...",
      "> Checking injection sinks in request handlers...",
      "> Mapping taint sources to vulnerable endpoints...",
      "> Cross-referencing auth middleware chains...",
      "> Evaluating RLS policy coverage...",
      "> Running Qwen3.6-27B patch synthesis...",
      "> Generating minimal diffs for each finding...",
      "> Verifying patches preserve original behaviour...",
      "> Writing patches to shadow branch...",
      "> Cross-checking antibody library for known patterns...",
      "> Validating output schema...",
    ];

    let currentIndex = 0;
    let phase2Index = 0;
    let phase = 1;
    setLogs([PHASE1_LOGS[0] ?? '']);

    const interval = setInterval(() => {
      if (phase === 1) {
        currentIndex++;
        if (currentIndex < PHASE1_LOGS.length) {
          const next = PHASE1_LOGS[currentIndex];
          if (next !== undefined) setLogs(prev => [...prev, next]);
        } else {
          phase = 2;
        }
      } else {
        const next = PHASE2_LOGS[phase2Index % PHASE2_LOGS.length];
        if (next !== undefined) setLogs(prev => [...prev, next]);
        phase2Index++;
      }
    }, 600);

    const timer = setInterval(() => setElapsed(s => s + 1), 1000);

    return () => { clearInterval(interval); clearInterval(timer); };
  }, [scanning]);

  useEffect(() => {
    // Keep the log view pinned to the latest line, but scroll ONLY this
    // container — never call scrollIntoView, which bubbles up and scrolls the
    // whole page, fighting the user's manual scroll (the up/down glitch). Also
    // skip if the user has scrolled up to read, so we don't yank them back down.
    const el = logsContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const getCleanConfig = (): CleanScanConfig => {
    const clean: CleanScanConfig = {
      repoId: config.repoId,
      method: config.method
    }

    if (config.rulesets?.length > 0) {
      clean.rulesets = config.rulesets.map(h => ({ key: h.key, value: h.value }))
    }
    if (config.ignorePaths?.length > 0) {
      clean.ignorePaths = config.ignorePaths.map(q => ({ key: q.key, value: q.value }))
    }
    if (config.branches?.length > 0) {
      clean.branches = config.branches.map(p => ({ key: p.key, value: p.value }))
    }
    if (config.custom?.length > 0) {
      clean.custom = config.custom.map(b => ({ key: b.key, value: b.value }))
    }

    return clean
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full bg-[#fafaf7]">
      {/* Left side - Configuration */}
      <ResizablePanel defaultSize="66%" minSize="50%">
        <div className="flex flex-col gap-4 h-full p-6 bg-white rounded-xl shadow-sm border-2 border-[#18181b]">
          <div className="flex flex-col sm:flex-row gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-[110px] justify-between bg-white border-2 border-[#18181b] text-[#18181b] font-semibold hover:bg-[#18181b] hover:text-white transition-colors">
                  {config.method}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-2 border-[#18181b] text-[#18181b]">
                {['SAST', 'DAST', 'SECRETS', 'FULL', 'CUSTOM'].map((method) => (
                  <DropdownMenuItem
                    key={method}
                    onClick={() => updateConfig('method', method as ScanMethod)}
                    className="focus:bg-[#18181b] focus:text-white"
                  >
                    <div className="flex items-center">
                      {method}
                      {config.method === method && (
                        <Check className="ml-2 h-4 w-4" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <select
              value={config.repoId}
              onChange={(e) => updateConfig('repoId', e.target.value)}
              className="flex-1 h-10 bg-white text-[#18181b] border-2 border-[#18181b] rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
            >
              <option value="" disabled className="text-[#888]">Select GitHub Repository...</option>
              {connections.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1 border-b-2 border-[#18181b]/10">
            {[
              { value: 'rulesets', label: 'Rulesets', supportedTab: ['SAST', 'DAST', 'SECRETS', 'FULL', 'CUSTOM'] },
              { value: 'ignorePaths', label: 'Ignore Paths', supportedTab: ['SAST', 'DAST', 'SECRETS', 'FULL', 'CUSTOM'] },
              { value: 'branches', label: 'Branches', supportedTab: ['SAST', 'DAST', 'SECRETS', 'FULL', 'CUSTOM'] },
              { value: 'custom', label: 'Custom Config', supportedTab: ['CUSTOM'] }
            ]
              .filter((t) => t.supportedTab.includes(config.method))
              .map((t) => (
                <button
                  key={t.value}
                  onClick={() => setActiveTab(t.value as TabType)}
                  className={cn(
                    'px-4 py-3 text-sm font-semibold border-b-2 -mb-[2px] transition-colors rounded-t-md',
                    activeTab === t.value
                      ? 'border-emerald-500 text-[#18181b]'
                      : 'border-transparent text-[#71717a] hover:text-[#18181b]'
                  )}
                >
                  {t.label}
                </button>
              ))}
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-3">
              {activeTabMap?.map((activeTabMapItem: Parameter) => (
                <div key={activeTabMapItem.id} className="flex items-center gap-3">
                  <Input
                    placeholder="Key"
                    className="flex-1 h-10 bg-white text-[#18181b] placeholder-[#a1a1aa] border border-[#dcdcd5] rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    value={activeTabMapItem.key}
                    onChange={(e) => updateActiveTabMapItem(activeTab as keyof typeof map, activeTabMapItem.id, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Value"
                    className="flex-1 h-10 bg-white text-[#18181b] placeholder-[#a1a1aa] border border-[#dcdcd5] rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    value={activeTabMapItem.value}
                    onChange={(e) => updateActiveTabMapItem(activeTab as keyof typeof map, activeTabMapItem.id, 'value', e.target.value)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-md border-2 border-red-500/40 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors flex-shrink-0"
                    onClick={() => removeActiveTabMapItem(activeTab as keyof typeof map, activeTabMapItem.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-4 h-10 bg-white border-2 border-[#18181b] text-[#18181b] font-semibold hover:bg-[#18181b] hover:text-white transition-colors"
                onClick={() => addActiveTabMapItem(activeTab as keyof typeof map)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {activeTab === 'ignorePaths' ? 'Path' : activeTab === 'branches' ? 'Branch' : titleCase(activeTab)}
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t-2 border-[#18181b]/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={scanning} variant="outline" size="sm" className="h-10 bg-white border-2 border-[#18181b] text-[#18181b] font-semibold hover:bg-[#18181b] hover:text-white transition-colors">
                  Presets
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-2 border-[#18181b] text-[#18181b]">
                <DropdownMenuItem className="focus:bg-[#18181b] focus:text-white" onClick={() => applyExampleConfig('owasp')}>OWASP Top 10 Audit</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#18181b] focus:text-white" onClick={() => applyExampleConfig('secrets')}>Deep Secrets Scan</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#18181b] focus:text-white" onClick={() => applyExampleConfig('fast')}>Fast SAST</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={testApi}
              disabled={!config.repoId?.trim() || scanning}
              size="sm"
              className="h-10 px-6 bg-[#18181b] text-white border-2 border-[#18181b] hover:bg-emerald-600 hover:border-emerald-600 active:scale-95 transition-all disabled:opacity-40"
              style={{ boxShadow: scanning ? "none" : "0 0 0 3px rgba(16,185,129,0.15)" }}
            >
              {scanning ? `Scanning… ${elapsed}s` : '▶ Run Security Scan'}
            </Button>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-transparent" />

      {/* Right side - JSON preview */}
      <ResizablePanel defaultSize="34%" minSize="25%">
        <div className="h-full">
          <ResizablePanelGroup orientation="vertical" className="bg-[#fafaf7]">
            {/* Configuration JSON / Live Logs — Top Half */}
            <ResizablePanel defaultSize="50%" minSize="30%">
              <div className="h-full bg-white rounded-xl shadow-sm border-2 border-[#18181b]">
                <div className="p-4 h-full flex flex-col">
                  <h3 className="text-sm font-semibold mb-3 text-[#18181b] border-b-2 border-[#18181b]/10 pb-2 flex items-center justify-between">
                    <span>{scanning ? 'Live Analysis' : 'Scan Configuration'}</span>
                    {scanning && (
                      <span className="text-emerald-600 text-xs font-mono tabular-nums">
                        {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                      </span>
                    )}
                  </h3>
                  <div ref={logsContainerRef} className="overflow-auto flex-1 bg-[#18181b] rounded-lg p-4 font-mono text-xs relative">
                    {scanning ? (
                      <div className="flex flex-col gap-2">
                        {logs.map((log, i) => (
                          <div key={i} className="text-emerald-400">{log}</div>
                        ))}
                        <div className="flex gap-1 items-center mt-2 text-emerald-400">
                          <span>&gt;</span>
                          <span className="w-2 h-4 bg-emerald-400 animate-pulse" />
                        </div>
                      </div>
                    ) : (
                      <pre className="text-[#e4e4e7]">
                        {JSON.stringify(getCleanConfig(), null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>

            {/* Scan Findings — Bottom Half (always rendered for stable panel sizing) */}
            <ResizableHandle withHandle className="bg-transparent my-1" />
            <ResizablePanel defaultSize="50%" minSize="30%">
              <div className="h-full bg-white rounded-xl shadow-sm border-2 border-[#18181b]">
                <div className="p-4 h-full flex flex-col">
                  <h3 className="text-sm font-semibold mb-3 text-[#18181b] border-b-2 border-[#18181b]/10 pb-2">Scan Findings</h3>
                  <div className="text-xs overflow-auto flex-1 bg-[#18181b] rounded-lg p-4 font-mono">
                    {config.rawResponse?.error ? (
                      <span className="text-red-400 font-medium">{config.rawResponse.error}</span>
                    ) : config.rawResponse?.data !== undefined ? (
                      <span className="text-[#e4e4e7]">{JSON.stringify(config.rawResponse.data, null, 2)}</span>
                    ) : (
                      <span className="text-[#71717a]">Run a scan to see findings here.</span>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

const DUMMY_OWASP_CONFIG: Omit<ScanPreset, 'tool_type'> = {
  name: 'owasp_audit',
  config: {
    repoId: '',
    method: 'FULL',
    rulesets: [
      { id: 'rs-1', key: 'Injection', value: 'Enabled' },
      { id: 'rs-2', key: 'BrokenAuth', value: 'Enabled' },
      { id: 'rs-3', key: 'XSS', value: 'Enabled' }
    ],
    ignorePaths: [
      { id: 'ip-1', key: 'tests/', value: 'true' },
      { id: 'ip-2', key: 'docs/', value: 'true' }
    ],
    branches: [
      { id: 'b-1', key: 'main', value: 'true' }
    ],
    custom: []
  }
}

const DUMMY_SECRETS_CONFIG: Omit<ScanPreset, 'tool_type'> = {
  name: 'deep_secrets',
  config: {
    repoId: '',
    method: 'SECRETS',
    rulesets: [
      { id: 'rs-1', key: 'AWSKeys', value: 'Enabled' },
      { id: 'rs-2', key: 'StripeTokens', value: 'Enabled' },
      { id: 'rs-3', key: 'DBPasswords', value: 'Enabled' }
    ],
    ignorePaths: [],
    branches: [
      { id: 'b-1', key: '*', value: 'true' }
    ],
    custom: []
  }
}

const DUMMY_FAST_CONFIG: Omit<ScanPreset, 'tool_type'> = {
  name: 'fast_sast',
  config: {
    repoId: '',
    method: 'SAST',
    rulesets: [
      { id: 'rs-1', key: 'HighSeverityOnly', value: 'Enabled' }
    ],
    ignorePaths: [
      { id: 'ip-1', key: 'node_modules/', value: 'true' }
    ],
    branches: [
      { id: 'b-1', key: 'develop', value: 'true' }
    ],
    custom: []
  }
}
