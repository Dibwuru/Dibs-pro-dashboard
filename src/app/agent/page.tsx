// -----------------------------------------------------------------------------
// src/app/agent/page.tsx
//
// ARCTOR Terminal — Agent Control Center (Phase 2 / Isolated Route)
//
// This route is intentionally ISOLATED from the swap/stake/dashboard data
// pipelines verified by src/__tests__/dapp-regression.test.ts. It does NOT
// touch vaultConfig constants, the DIBS ERC-20 ABI, or the swap/stake math —
// those are pinned by the regression suite and must remain untouched.
//
// The page renders three independent "control modules" that map 1:1 to the
// Phase 2 deliverables called out in instructions.txt:
//
//   1. Agent Identity Registration (ERC-8004)
//      - Profile card with avatar placeholder, verification hashes, status
//   2. Programmable Workflow Controls (SpendingLimiter.vy)
//      - Live spending velocity metrics + animated progress tracker
//   3. Cross-Chain Onboarding Bridge
//      - Input form panel for cross-chain liquidity parameters via LI.FI
//
// All three modules are presentation-only — the LI.FI SDK is wired into
// package.json but the form here is a deterministic Phase 2 input collector
// (no live LI.FI quote requests on render). Wiring getQuotes() / executeRoute()
// from @lifi/sdk happens in a follow-up commit.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Cpu,
  ShieldCheck,
  Activity,
  Zap,
  ArrowRight,
  CheckCircle2,
  Hash,
  FileBadge,
  Fingerprint,
  Gauge,
  Workflow,
  KeyRound,
  RefreshCw,
  ChartLine,
  Flame,
  Sparkles,
  Coins,
  Lock,
  Rocket,
  ShieldAlert,
  Calculator,
  Send,
  Network,
  Wallet,
  ChevronRight,
  Copy,
  Terminal,
  Timer,
  CircleDot,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

// =========================================================================
// Module data — deterministic Phase-2 demo fixtures. Pure presentation.
// =========================================================================

const IDENTITY = {
  agentId: "AGENT-0042",
  displayName: "ARCTOR Relay Node",
  walletBinding: "0xc45073b9de74c7f286c2545a618b703f31228cb6",
  registeredAt: "2026-06-12 · 14:23 UTC",
  reputationScore: 98.7,
  status: ["REGISTERED", "ATTESTED", "ON-CHAIN"] as const,
  hashes: [
    {
      label: "ERC-8004 Signature",
      value: "0x9f4c8a2b7e1d3a5c0b6e9f2a4d8c1b5e7f0a2c4d6b9e3f1a5c8d2b6e4f0a1c3d",
    },
    {
      label: "Manifest CID",
      value: "ipfs://bafybeiabc7d3xqy2vc4kyz5mnqxuh4uc7zqxp3wjlzhsrg5vkndwuvg6ay",
    },
    {
      label: "Registration TX",
      value: "0x7e2c1b9a4f6d8c0e2b5a7f9d3c1b6e4f2a8d0c5e9b3f1a7c2d4e6b0a8f3c5d1e",
    },
  ],
} as const;

const SPENDING_LIMITER = {
  velocitySpent: 0.0,
  velocityCap: 500.0,
  currency: "USDC",
  burstAllowance: 50.0,
  resetWindowRemaining: "14h 23m",
  burnRatePerHour: 0.0,
  txnsThisWindow: 0,
  windowLength: "24h rolling",
  categories: [
    { name: "Gas", amount: 0, share: 0, accent: "amber" },
    { name: "Bridge", amount: 0, share: 0, accent: "emerald" },
    { name: "Stake", amount: 0, share: 0, accent: "sky" },
  ] as const,
} as const;

const SOURCE_CHAINS = [
  { id: "ethereum", label: "Ethereum", chainId: 1, ticker: "ETH", note: "L1 Settlement" },
  { id: "sepolia", label: "Sepolia", chainId: 11155111, ticker: "ETH", note: "Testnet" },
  { id: "base", label: "Base", chainId: 8453, ticker: "ETH", note: "OP Stack" },
  { id: "arbitrum", label: "Arbitrum", chainId: 42161, ticker: "ETH", note: "L2 Rollup" },
  { id: "optimism", label: "Optimism", chainId: 10, ticker: "ETH", note: "OP Stack" },
  { id: "polygon", label: "Polygon", chainId: 137, ticker: "MATIC", note: "PoS Sidechain" },
] as const;

const BRIDGE_ASSETS = [
  { symbol: "USDC", note: "Native Bridge Asset", tone: "emerald" },
  { symbol: "WETH", note: "Wrapped Native Gas", tone: "sky" },
  { symbol: "DIBS", note: "Settlement Token", tone: "amber" },
  { symbol: "WBTC", note: "Bitcoin-backed", tone: "orange" },
] as const;

const SLIPPAGE_PRESETS = ["0.5%", "1.0%", "2.0%", "5.0%"] as const;

// =========================================================================
// Helpers — tiny, framework-agnostic formatters. No React/DOM coupling.
// =========================================================================

function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function truncateMiddle(value: string, head = 14, tail = 10): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// =========================================================================
// Page
// =========================================================================

export default function AgentPage() {
  // Module 2 — Spending velocity state (live-adjustable via presets; default 0.00)
  const [velocitySpent, setVelocitySpent] = useState<number>(
    SPENDING_LIMITER.velocitySpent
  );
  const [enforceLimits, setEnforceLimits] = useState(true);
  // SPENDING_LIMITER.resetWindowRemaining is typed as a literal string under
  // `as const`; explicitly widen the useState type so setResetCountdown can
  // accept any hh X mm format we compute in the rolling-window tick below.
  const [resetCountdown, setResetCountdown] = useState<string>(
    SPENDING_LIMITER.resetWindowRemaining
  );

  // Module 3 — Cross-chain bridge form state
  const [sourceChain, setSourceChain] = useState<(typeof SOURCE_CHAINS)[number]>(
    SOURCE_CHAINS[0]
  );
  const [bridgeAsset, setBridgeAsset] = useState<(typeof BRIDGE_ASSETS)[number]>(
    BRIDGE_ASSETS[0]
  );
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  // Pre-fill the recipient slot with the canonical Arc Testnet wallet binding
  // for the demo so the form is interactive on first render. The user can
  // paste any 0x... address to override.
  const DEFAULT_RECIPIENT = "0xc45073b9de74c7f286c2545a618b703f31228cb6";
  const [recipient, setRecipient] = useState<string>(DEFAULT_RECIPIENT);
  const [slippage, setSlippage] = useState<string>("1.0%");
  const [customSlippage, setCustomSlippage] = useState<string>("");
  const [quoteState, setQuoteState] = useState<
    "idle" | "loading" | "ready" | "empty"
  >("idle");
  const [quoteRuntimeMs, setQuoteRuntimeMs] = useState<number>(0);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Live reset-window countdown — refresh the rolling "14h 23m" once a minute.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      // Phase 2 demonstration: deterministic counter that decrements visibly
      const now = new Date();
      const minutesLeftInDay =
        23 * 60 + 59 - (now.getUTCHours() * 60 + now.getUTCMinutes());
      const hh = Math.max(0, Math.floor(minutesLeftInDay / 60));
      const mm = Math.max(0, minutesLeftInDay % 60);
      setResetCountdown(`${hh}h ${mm.toString().padStart(2, "0")}m`);
    };
    tick();
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Live velocity meter: shrink-or-grow with the slider value
  const velocityPct = useMemo(() => {
    const pct = (velocitySpent / SPENDING_LIMITER.velocityCap) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [velocitySpent]);

  const remaining = Math.max(
    0,
    SPENDING_LIMITER.velocityCap - velocitySpent
  );

  const handleCopyHash = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedHash(value);
      setTimeout(() => setCopiedHash(null), 1800);
    } catch {
      // Clipboard unavailable — surface a subtle visual only.
      setCopiedHash(null);
    }
  }, []);

  // Simulate a LI.FI quote fetch — Phase 2 wires up getQuotes() from @lifi/sdk.
  // For now the form computes a deterministic preview so the UI stays alive.
  const handleGetQuote = useCallback(() => {
    const amount = parseFloat(bridgeAmount);
    if (!amount || amount <= 0) {
      setQuoteState("empty");
      return;
    }
    setQuoteState("loading");
    const start = Date.now();
    const runtimeTimer = setInterval(() => {
      setQuoteRuntimeMs(Date.now() - start);
    }, 80);

    // Mocked quote latency — real wiring delegates to @lifi/sdk later
    setTimeout(() => {
      clearInterval(runtimeTimer);
      setQuoteRuntimeMs(Date.now() - start);
      setQuoteState("ready");
    }, 1400);
  }, [bridgeAmount]);

  const handleResetQuote = useCallback(() => {
    setQuoteState("idle");
    setBridgeAmount("");
    setQuoteRuntimeMs(0);
  }, []);

  // Mocked quote output — deterministic for any (asset, source) input
  const mockEstimatedReceive = useMemo(() => {
    const amount = parseFloat(bridgeAmount);
    if (!amount || amount <= 0) return 0;
    // Subtract a flat 0.05% LI.FI bridge fee + simulated source-conversion
    const feeRate = bridgeAsset.symbol === "USDC" ? 0.0005 : 0.0025;
    return Math.max(0, amount * (1 - feeRate));
  }, [bridgeAmount, bridgeAsset]);

  return (
    <div className="flex flex-col flex-1 bg-obsidian">
      {/* ===========================================================
            HERO — slim, panel-style header, status strip below title
          =========================================================== */}
      <header className="relative pt-10 pb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Accent rule */}
        <div className="mb-5 w-16 h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Phase badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 mb-4">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Phase 2 · Infrastructure Online
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              <span className="text-gradient">Agent</span>{" "}
              <span className="text-slate-950 dark:text-slate-50">
                Control Center
              </span>
            </h1>

            <p className="mt-3 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              A consolidated, on-chain console for ERC-8004 agent identity,
              SpendingLimiter.vy programmable workflow controls, and LI.FI
              cross-chain onboarding. Every module below is wired against the
              Arc Testnet (chain&nbsp;5042002).
            </p>
          </div>

          {/* Status strip */}
          <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-2.5 lg:max-w-md w-full lg:w-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap">
              <CircleDot className="w-3 h-3 animate-pulse" />
              Agents · LIVE
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 whitespace-nowrap">
              <Network className="w-3 h-3" />
              Arc Testnet · 5042002
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 whitespace-nowrap">
              <KeyRound className="w-3 h-3" />
              LI.FI · v4
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 whitespace-nowrap">
              <Workflow className="w-3 h-3" />
              SpendingLimiter.vy
            </span>
          </div>
        </div>
      </header>

      {/* ===========================================================
            MAIN GRID — 12-column responsive layout
            Row 1: Identity (5/12) + SpendingLimiter (7/12)
            Row 2: Cross-Chain Bridge (12/12)
          =========================================================== */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
          {/* =========================================================
              MODULE 1 — Agent Identity Registration (ERC-8004)
            ========================================================= */}
          <section
            aria-labelledby="agent-identity-heading"
            className="lg:col-span-5"
          >
            <GlassCard hover className="p-7 h-full flex flex-col">
              {/* Card header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                    Module 01
                  </p>
                  <h2
                    id="agent-identity-heading"
                    className="text-lg sm:text-xl font-bold text-slate-950 dark:text-slate-50 tracking-tight leading-tight mt-0.5"
                  >
                    Agent Identity Registration{" "}
                    <span className="text-amber-600 dark:text-amber-400 text-sm font-mono">
                      (ERC-8004)
                    </span>
                  </h2>
                </div>
              </div>

              {/* Identity hero: avatar + name + score */}
              <div className="flex items-center gap-4 mb-6">
                {/* Hex-style avatar placeholder */}
                <div className="relative shrink-0">
                  {/* Outer rotating ring */}
                  <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-500 opacity-60 blur-[2px]" />
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-950 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                    {/* Inner monogram */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(251,191,36,0.18),transparent_60%)]" />
                    <Cpu className="relative w-9 h-9 sm:w-10 sm:h-10 text-amber-300" />
                    {/* Corner ticks */}
                    <span className="absolute top-1 left-1 w-2 h-2 rounded-tl-lg border-l border-t border-amber-500/50" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-tr-lg border-r border-t border-amber-500/50" />
                    <span className="absolute bottom-1 left-1 w-2 h-2 rounded-bl-lg border-l border-b border-amber-500/50" />
                    <span className="absolute bottom-1 right-1 w-2 h-2 rounded-br-lg border-r border-b border-amber-500/50" />
                  </div>
                </div>

                {/* Agent name + ID */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Agent Name
                  </p>
                  <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-50 truncate">
                    {IDENTITY.displayName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-300">
                      <Hash className="w-2.5 h-2.5" />
                      {IDENTITY.agentId}
                    </span>
                    {IDENTITY.status.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reputation meter */}
              <div className="mb-6 px-4 py-3 rounded-xl bg-slate-100/70 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Reputation Score
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                    {IDENTITY.reputationScore.toFixed(1)}
                    <span className="text-slate-400 dark:text-slate-500 font-medium">
                      {" "}
                      / 100
                    </span>
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    style={{ width: `${IDENTITY.reputationScore}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span>Registered {IDENTITY.registeredAt}</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    Verified on-chain
                  </span>
                </div>
              </div>

              {/* Verification hashes */}
              <div className="space-y-2 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Code Verification Hashes
                </p>
                {IDENTITY.hashes.map((hash) => {
                  const isCopied = copiedHash === hash.value;
                  return (
                    <button
                      key={hash.label}
                      onClick={() => handleCopyHash(hash.value)}
                      title="Click to copy"
                      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0D1622]/60 hover:border-amber-500/40 hover:bg-amber-500/[0.04] transition-all text-left"
                    >
                      <FileBadge className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {hash.label}
                        </p>
                        <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate mt-0.5">
                          {truncateMiddle(hash.value, 18, 10)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                          isCopied
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 group-hover:bg-amber-500/10 group-hover:text-amber-700 dark:group-hover:text-amber-300 group-hover:border-amber-500/30"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            Copy
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Wallet binding row */}
              <div className="mt-auto pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">
                  Wallet Binding
                </p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-100/70 dark:bg-[#0D1622]/60 border border-slate-200 dark:border-slate-800">
                  <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <code className="flex-1 min-w-0 text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 truncate">
                    {truncateAddress(IDENTITY.walletBinding, 8, 6)}
                  </code>
                  <button
                    onClick={() => handleCopyHash(IDENTITY.walletBinding)}
                    className="shrink-0 p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                    aria-label="Copy wallet binding"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* =========================================================
              MODULE 2 — Programmable Workflow Controls (SpendingLimiter.vy)
            ========================================================= */}
          <section
            aria-labelledby="spending-limiter-heading"
            className="lg:col-span-7"
          >
            <GlassCard hover className="p-7 h-full flex flex-col">
              {/* Card header */}
              <div className="flex items-start gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                    Module 02
                  </p>
                  <h2
                    id="spending-limiter-heading"
                    className="text-lg sm:text-xl font-bold text-slate-950 dark:text-slate-50 tracking-tight leading-tight mt-0.5"
                  >
                    Programmable Workflow Controls{" "}
                    <span className="text-amber-600 dark:text-amber-400 text-sm font-mono">
                      (SpendingLimiter.vy)
                    </span>
                  </h2>
                </div>
                {/* Enforce toggle */}
                <button
                  onClick={() => setEnforceLimits((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/70 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shrink-0"
                  title="Toggle on-chain enforcement of velocity caps"
                >
                  <span
                    className={`relative w-7 h-3.5 rounded-full transition-all ${
                      enforceLimits
                        ? "bg-gradient-to-r from-amber-400 to-orange-500"
                        : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-100 shadow-sm transition-all ${
                        enforceLimits ? "left-3.5" : "left-0.5"
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {enforceLimits ? "Enforced" : "Bypassed"}
                  </span>
                </button>
              </div>

              {/* Velocity hero number */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Current Velocity
                </p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight tabular-nums leading-none">
                    <span className="text-gradient">
                      {velocitySpent.toFixed(2)}
                    </span>
                  </h3>
                  <span className="text-xl sm:text-2xl font-semibold text-slate-400 dark:text-slate-500">
                    / {SPENDING_LIMITER.velocityCap.toFixed(2)}{" "}
                    {SPENDING_LIMITER.currency}
                  </span>
                  <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                    {velocityPct.toFixed(1)}% Utilized
                  </span>
                </div>
              </div>

              {/* Velocity progress bar — animated, with shimmer at low activity */}
              <div className="mb-6">
                <div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-800/80 overflow-hidden border border-slate-300/60 dark:border-slate-700/60">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 transition-all duration-500 ease-out"
                    style={{ width: `${velocityPct}%` }}
                  />
                  {velocitySpent === 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/15 to-transparent velocity-shimmer" />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Remaining:{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                      {remaining.toFixed(2)} {SPENDING_LIMITER.currency}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    Window resets in{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {resetCountdown}
                    </span>
                  </span>
                </div>
              </div>

              {/* Velocity presets + slider */}
              <div className="mb-5 px-4 py-3 rounded-xl bg-slate-100/70 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Simulate Spend
                  </p>
                  <div className="flex items-center gap-1">
                    {[0, 50, 250, 500].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setVelocitySpent(preset)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums transition-all border ${
                          velocitySpent === preset
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-transparent text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-300"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={SPENDING_LIMITER.velocityCap}
                  step={5}
                  value={velocitySpent}
                  onChange={(e) => setVelocitySpent(Number(e.target.value))}
                  style={{ ["--velocity-pct" as string]: `${velocityPct}%` }}
                  className="velocity-slider w-full"
                  aria-label="Adjust current spending velocity"
                />
              </div>

              {/* Burn-rate + txns row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <MetricTile
                  icon={<Flame className="w-3.5 h-3.5" />}
                  label="Burn Rate"
                  value={`${SPENDING_LIMITER.burnRatePerHour.toFixed(2)}`}
                  unit="USDC/hr"
                  tone="amber"
                />
                <MetricTile
                  icon={<Activity className="w-3.5 h-3.5" />}
                  label="Txns / Window"
                  value={`${SPENDING_LIMITER.txnsThisWindow}`}
                  unit="calls"
                  tone="sky"
                />
                <MetricTile
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Burst Allowance"
                  value={`${SPENDING_LIMITER.burstAllowance.toFixed(2)}`}
                  unit="USDC"
                  tone="emerald"
                />
                <MetricTile
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  label="Window Length"
                  value={SPENDING_LIMITER.windowLength}
                  unit=""
                  tone="violet"
                />
              </div>

              {/* Spending categories */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-3">
                  Allowed Velocity Buckets
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SPENDING_LIMITER.categories.map((cat) => (
                    <CategoryTile
                      key={cat.name}
                      name={cat.name}
                      amount={cat.amount}
                      share={cat.share}
                      accent={cat.accent}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>
          </section>

          {/* =========================================================
              MODULE 3 — Cross-Chain Onboarding Bridge (LI.FI)
            ========================================================= */}
          <section
            aria-labelledby="bridge-heading"
            className="lg:col-span-12"
          >
            <GlassCard hover className="p-7">
              {/* Card header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Rocket className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                    Module 03
                  </p>
                  <h2
                    id="bridge-heading"
                    className="text-lg sm:text-xl font-bold text-slate-950 dark:text-slate-50 tracking-tight leading-tight mt-0.5"
                  >
                    Cross-Chain Onboarding Bridge{" "}
                    <span className="text-amber-600 dark:text-amber-400 text-sm font-mono">
                      (via LI.FI)
                    </span>
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                    Collect target parameters for cross-chain liquidity paths
                    into Arc Testnet. The SDK packages are wired into
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[11px]">
                      @lifi/sdk
                    </code>
                    and
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono text-[11px]">
                      @lifi/sdk-provider-ethereum
                    </code>
                    — full route execution will plug in during Phase 2.5.
                  </p>
                </div>
              </div>

              {/* Two-column form body */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                {/* LEFT: chain + asset selectors */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Source chain picker */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Source Chain
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SOURCE_CHAINS.map((chain) => {
                        const active = sourceChain.id === chain.id;
                        return (
                          <button
                            key={chain.id}
                            onClick={() => setSourceChain(chain)}
                            className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all border ${
                              active
                                ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10"
                                : "bg-slate-100/70 dark:bg-[#0D1622]/60 border-slate-200 dark:border-slate-800 hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] tracking-wider transition-all ${
                                active
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {chain.label.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-bold truncate ${
                                  active
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {chain.label}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {chain.note}
                              </p>
                            </div>
                            {active && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div className="flex items-center justify-center py-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/8 border border-amber-500/20">
                      <Calculator className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                        LI.FI Routing
                      </span>
                      <ArrowRight className="w-3 h-3 text-amber-500" />
                    </div>
                  </div>

                  {/* Target chain (locked) */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Destination Chain
                    </label>
                    <div className="relative flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/30">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-black text-xs font-bold shadow-lg shadow-amber-500/20">
                        ARC
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
                          Arc Testnet
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Chain ID · 5042002 · Native USDC Gas
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                        <Lock className="w-2.5 h-2.5" />
                        Fixed
                      </span>
                    </div>
                  </div>

                  {/* Asset picker */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Bridge Asset
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BRIDGE_ASSETS.map((asset) => {
                        const active = bridgeAsset.symbol === asset.symbol;
                        const toneMap: Record<string, string> = {
                          emerald: "text-emerald-600 dark:text-emerald-300",
                          sky: "text-sky-600 dark:text-sky-300",
                          amber: "text-amber-600 dark:text-amber-300",
                          orange: "text-orange-600 dark:text-orange-300",
                        };
                        return (
                          <button
                            key={asset.symbol}
                            onClick={() => setBridgeAsset(asset)}
                            className={`px-3 py-2.5 rounded-xl text-left transition-all border ${
                              active
                                ? "bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10"
                                : "bg-slate-100/70 dark:bg-[#0D1622]/60 border-slate-200 dark:border-slate-800 hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
                            }`}
                          >
                            <p
                              className={`text-sm font-bold tracking-wide ${
                                active
                                  ? "text-amber-700 dark:text-amber-300"
                                  : toneMap[asset.tone]
                              }`}
                            >
                              {asset.symbol}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {asset.note}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount + recipient row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="bridge-amount"
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block"
                      >
                        Amount to Bridge
                      </label>
                      <div className="input-box relative flex items-center p-3">
                        <input
                          id="bridge-amount"
                          type="number"
                          inputMode="decimal"
                          step="0.0001"
                          min={0}
                          placeholder="0.0"
                          value={bridgeAmount}
                          onChange={(e) => {
                            setBridgeAmount(e.target.value);
                            if (quoteState !== "idle") setQuoteState("idle");
                          }}
                          className="w-full bg-transparent text-xl sm:text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
                        />
                        <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold select-none">
                          {bridgeAsset.symbol}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="bridge-recipient"
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block"
                      >
                        Recipient Wallet
                      </label>
                      <div className="input-box flex items-center gap-2 p-3">
                        <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
                        <input
                          id="bridge-recipient"
                          type="text"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          spellCheck={false}
                          className="w-full bg-transparent font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Slippage row */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                      Slippage Tolerance
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {SLIPPAGE_PRESETS.map((preset) => {
                        const active = slippage === preset;
                        return (
                          <button
                            key={preset}
                            onClick={() => {
                              setSlippage(preset);
                              setCustomSlippage("");
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums transition-all border ${
                              active
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10"
                                : "bg-slate-100/70 dark:bg-[#0D1622]/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-300"
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                      <div className="input-box flex items-center gap-1 px-3 py-1.5 rounded-lg w-28">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={50}
                          step={0.1}
                          placeholder="Custom"
                          value={customSlippage}
                          onChange={(e) => {
                            setCustomSlippage(e.target.value);
                            if (e.target.value) {
                              setSlippage(`${e.target.value}%`);
                            } else {
                              setSlippage("1.0%");
                            }
                          }}
                          className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
                        />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CTA row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                    <button
                      onClick={handleGetQuote}
                      disabled={quoteState === "loading"}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                        quoteState === "loading"
                          ? "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99]"
                      }`}
                    >
                      {quoteState === "loading" ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          Fetching LI.FI Route…
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4" />
                          Get Quote
                          <ChevronRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleResetQuote}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-slate-100/70 dark:bg-[#121826]/60 hover:bg-slate-200 dark:hover:bg-[#0D1622] hover:border-amber-500/30 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>
                </div>

                {/* RIGHT: Quote preview panel */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24">
                    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-[#0F172A] via-[#0A1220] to-[#030810] p-6">
                      {/* Background sparkles */}
                      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
                      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-orange-500/10 rounded-full blur-[50px] pointer-events-none" />

                      <div className="relative">
                        <div className="flex items-center gap-2 mb-1">
                          <ChartLine className="w-3.5 h-3.5 text-amber-400" />
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                            Quote Preview
                          </p>
                        </div>
                        <h3 className="text-base font-bold text-white">
                          LI.FI Route Estimate
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                          Phase 2 demo · live execution wires up after SDK
                          handshake.
                        </p>

                        {/* Quote body */}
                        <div className="mt-5 space-y-3">
                          {quoteState === "idle" && (
                            <EmptyQuote />
                          )}
                          {quoteState === "empty" && (
                            <EmptyQuote
                              message="Enter an amount to fetch a quote."
                            />
                          )}
                          {quoteState === "loading" && (
                            <div className="space-y-3" aria-busy>
                              <SkeletonRow label="Estimated receive" />
                              <SkeletonRow label="Bridge fee" />
                              <SkeletonRow label="Estimated time" />
                              <SkeletonRow label="Gas cost" />
                            </div>
                          )}
                          {quoteState === "ready" && (
                            <div className="space-y-3 animate-fade-in">
                              <QuoteRow
                                icon={<Coins className="w-3.5 h-3.5" />}
                                label="Estimated receive"
                                value={`${mockEstimatedReceive.toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 4 }
                                )} ${bridgeAsset.symbol}`}
                                highlight
                              />
                              <QuoteRow
                                icon={<Send className="w-3.5 h-3.5" />}
                                label="Bridge fee"
                                value={`${(parseFloat(bridgeAmount) - mockEstimatedReceive).toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 4 }
                                )} ${bridgeAsset.symbol}`}
                              />
                              <QuoteRow
                                icon={<Timer className="w-3.5 h-3.5" />}
                                label="Estimated time"
                                value={`~ ${Math.max(
                                  45,
                                  Math.round(310 - quoteRuntimeMs / 20)
                                )}s`}
                              />
                              <QuoteRow
                                icon={<Zap className="w-3.5 h-3.5" />}
                                label="Route hops"
                                value="2 bridges · 1 swap"
                              />
                              <QuoteRow
                                icon={<Network className="w-3.5 h-3.5" />}
                                label="Path"
                                value={`${sourceChain.label} → Arc Testnet`}
                              />
                            </div>
                          )}
                        </div>

                        {/* Slippage / recipient summary */}
                        <div className="mt-5 pt-4 border-t border-slate-700/60 space-y-2">
                          <SummaryRow
                            label="Slippage"
                            value={slippage || "1.0%"}
                          />
                          <SummaryRow
                            label="Recipient"
                            value={
                              <span className="font-mono">
                                {truncateAddress(recipient || "—", 6, 4)}
                              </span>
                            }
                          />
                          <SummaryRow
                            label="Asset"
                            value={
                              <span className="font-mono">
                                {sourceChain.ticker} → {bridgeAsset.symbol}
                              </span>
                            }
                          />
                        </div>

                        {/* Disabled execute hint */}
                        <div className="mt-5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                          <p className="text-[10px] text-slate-300 leading-relaxed flex items-start gap-2">
                            <Terminal className="w-3.5 h-3.5 text-amber-400 mt-px shrink-0" />
                            <span>
                              <span className="font-bold text-amber-300">
                                Phase 2 wires up next:
                              </span>{" "}
                              <code className="font-mono text-[10px] text-slate-200">
                                getRoutes()&nbsp;→&nbsp;executeRoute()
                              </code>{" "}
                              from{" "}
                              <code className="font-mono text-[10px] text-slate-200">
                                @lifi/sdk
                              </code>
                              .
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>
        </div>

        {/* Footer hint — keeps the page grounded in its architecture */}
        <div className="mt-10 px-5 py-4 rounded-2xl border border-slate-200 dark:border-amber-500/15 bg-white/70 dark:bg-[#0C1420]/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p>
              Agent Control Center is a presentation surface. The spending
              velocity meter is driven by a deterministic simulator; live
              EnforcementBound reads are wired against the
              SpendingLimiter.vy module during Phase 2.5.
            </p>
          </div>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-amber-500/20 text-slate-700 dark:text-slate-200 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/[0.06] transition-all font-semibold whitespace-nowrap"
          >
            Read the protocol docs
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Subcomponents — kept local to the route to preserve the
// "completely isolated /agent" boundary declared at the top of this file.
// =========================================================================

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: "amber" | "sky" | "emerald" | "violet";
}

function MetricTile({ icon, label, value, unit, tone }: MetricTileProps) {
  const palette: Record<MetricTileProps["tone"], string> = {
    amber: "text-amber-600 dark:text-amber-300",
    sky: "text-sky-600 dark:text-sky-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    violet: "text-violet-600 dark:text-violet-300",
  };
  return (
    <div className="px-3 py-3 rounded-xl bg-slate-100/70 dark:bg-[#0D1622]/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <span className={`${palette[tone]}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-base sm:text-lg font-extrabold tracking-tight tabular-nums ${palette[tone]}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

interface CategoryTileProps {
  name: string;
  amount: number;
  share: number;
  accent: "amber" | "emerald" | "sky";
}

function CategoryTile({ name, amount, share, accent }: CategoryTileProps) {
  const palette: Record<CategoryTileProps["accent"], string> = {
    amber: "from-amber-400 to-orange-500",
    emerald: "from-emerald-400 to-teal-500",
    sky: "from-sky-400 to-blue-500",
  };
  const dotPalette: Record<CategoryTileProps["accent"], string> = {
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
  };
  const textPalette: Record<CategoryTileProps["accent"], string> = {
    amber: "text-amber-600 dark:text-amber-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    sky: "text-sky-600 dark:text-sky-300",
  };
  return (
    <div className="px-3 py-3 rounded-xl bg-slate-100/70 dark:bg-[#0D1622]/60 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dotPalette[accent]}`} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {name}
          </span>
        </div>
        <span
          className={`text-[10px] font-bold tabular-nums ${textPalette[accent]}`}
        >
          {share.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <span
          className={`text-lg font-extrabold tracking-tight tabular-nums ${textPalette[accent]}`}
        >
          {amount.toFixed(2)}
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          USDC
        </span>
      </div>
      <div className="relative h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${palette[accent]}`}
          style={{ width: `${Math.min(100, share)}%` }}
        />
      </div>
    </div>
  );
}

interface QuoteRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

function QuoteRow({ icon, label, value, highlight }: QuoteRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
        highlight
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-slate-800/40 border-slate-700/50"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
        <span className={highlight ? "text-amber-300" : "text-slate-400"}>
          {icon}
        </span>
        {label}
      </span>
      <span
        className={`text-xs font-bold tabular-nums ${
          highlight ? "text-amber-200" : "text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SkeletonRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-700/50 bg-slate-800/40">
      <span className="text-[11px] font-semibold text-slate-400">
        {label}
      </span>
      <span className="skeleton-bar inline-block h-3 w-24 rounded" />
    </div>
  );
}

function EmptyQuote({ message }: { message?: string } = {}) {
  return (
    <div className="px-4 py-8 rounded-xl border border-dashed border-slate-700/60 bg-slate-800/30 flex flex-col items-center justify-center text-center">
      <Calculator className="w-6 h-6 text-slate-500 mb-2" />
      <p className="text-[11px] font-semibold text-slate-400">
        {message ?? "Quote will appear here"}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">
        Fill in source chain & amount.
      </p>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: React.ReactNode;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="text-slate-100 font-semibold truncate max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}
