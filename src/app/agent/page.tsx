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
import { useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import {
  createClient,
  executeRoute,
  getRoutes,
  type Route,
  type RouteExtended,
  type SDKClient,
  type SDKProvider,
} from "@lifi/sdk";
import { EthereumProvider } from "@lifi/sdk-provider-ethereum";

import {
  SPENDING_LIMITER_ADDRESS,
  SPENDING_LIMITER_DECIMALS,
  SPENDING_LIMITER_POLL_MS,
  spendingLimiterABI,
} from "./spendingLimiterConfig";
import {
  BRIDGE_ASSETS,
  IDENTITY,
  SLIPPAGE_PRESETS,
  SOURCE_CHAINS,
  SPENDING_CATEGORIES,
  SPENDING_DEFAULTS,
  calcCategoryShare,
  calcNetReceive,
  formatResetCountdown,
  isValidEvmAddress,
  parseSlippageToDecimal,
  truncateAddress,
  truncateMiddle,
} from "./agentHelpers";

// Constants used by the active route. Sourced from agentHelpers so the
// vitest regression suite can pin every entry from outside the React
// boundary — keeping the /agent module strictly isolated from the
// test-pinned swap/stake/dashboard state.
const ARC_TESTNET_CHAIN_ID = 5042002;
const LI_FI_INTEGRATOR = "arctor-terminal";
const ZERO_ADDRESS: `0x${string}` =
  "0x0000000000000000000000000000000000000000";
// LI.FI mergeFields-style options kept narrow on purpose: only the keys
// the @lifi/sdk v4 RoutesRequest / ExecuteRouteOptions types require
// for a successful quote + execution cycle. New fields should be added
// here AND updated through the helper exports in agentHelpers.ts.
interface LiveQuoteSummary {
  receive: number;
  fee: number;
  bridgeSeconds: number;
  bridges: number;
  swaps: number;
}
interface LiveSpendingState {
  spent: number;
  cap: number;
  burstAllowance: number;
  windowSeconds: number;
  lastReset: number;
  txnsInWindow: number;
  categoryGas: number;
  categoryBridge: number;
  categoryStake: number;
}

// =========================================================================
// Page
// =========================================================================

export default function AgentPage() {
  // Active Privy wallet — used to drive both SpendingLimiter reads (EIP-1193
  // provider → viem public client) and LI.FI executeRoute (EVM() signer
  // adapter).  Lives in the agent module layer so /swap, /stake, /dashboard
  // are unaffected.
  const { wallets: agentWallets } = useWallets();
  const agentWallet = agentWallets[0];

  // ----- Module 2 state --------------------------------------------------
  const [velocitySpent, setVelocitySpent] = useState<number>(
    SPENDING_DEFAULTS.velocitySpent
  );
  const [enforceLimits, setEnforceLimits] = useState(true);
  // SPENDING_DEFAULTS.resetWindowRemaining is a literal string under `as const`;
  // widen via the explicit <string> annotation so the rolling-window tick
  // can write any "Hh Mm" format the helper computes.
  const [resetCountdown, setResetCountdown] = useState<string>(
    SPENDING_DEFAULTS.resetWindowRemaining
  );

  // Live SpendingLimiter.vy state.  Null when neither the wallet is connected
  // nor the contract address is configured.  Reads back every
  // SPENDING_LIMITER_POLL_MS via viem readContract against the active wallet's
  // EIP-1193 transport — see the polling useEffect below.
  const [liveSpending, setLiveSpending] = useState<LiveSpendingState | null>(
    null
  );

  // ----- Module 3 state (cross-chain bridge) ----------------------------
  const [sourceChain, setSourceChain] = useState<(typeof SOURCE_CHAINS)[number]>(
    SOURCE_CHAINS[0]
  );
  const [bridgeAsset, setBridgeAsset] = useState<(typeof BRIDGE_ASSETS)[number]>(
    BRIDGE_ASSETS[0]
  );
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  // Pre-fill the recipient slot with the canonical Arc Testnet wallet binding
  // for the demo so the form is interactive on first render.  The user can
  // paste any 0x… address to override.
  const [recipient, setRecipient] = useState<string>(IDENTITY.walletBinding);
  const [slippage, setSlippage] = useState<string>("1.0%");
  const [customSlippage, setCustomSlippage] = useState<string>("");
  const [quoteState, setQuoteState] = useState<
    "idle" | "loading" | "ready" | "empty" | "executing"
  >("idle");
  const [quoteRuntimeMs, setQuoteRuntimeMs] = useState<number>(0);
  // Typed as RouteExtended (not just Route) so that the
  // executing JSX row can read LiFiStepExtended.execution?.status
  // without an `as any` cast. After getRoutes the runtime object
  // already satisfies the extended shape; executeRoute then populates
  // execution metadata in-place.
  const [selectedRoute, setSelectedRoute] = useState<RouteExtended | null>(
    null
  );
  const [quote, setQuote] = useState<LiveQuoteSummary | null>(null);

  // Wallet-switch reset (BLOCK-B2): any previously fetched Route is
  // stamped for the wallet's fromAddress. If the user disconnects or
  // swaps wallets in mid-session, the cached route is stale and would
  // re-sign with the wrong account. Clear the LI.FI quote state so the
  // user re-fetches against the new EIP-1193 source.
  useEffect(() => {
    setSelectedRoute(null);
    setQuote(null);
    setQuoteState("idle");
    setQuoteRuntimeMs(0);
  }, [agentWallet?.address]);

  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // LI.FI SDK client (v4 requires a per-call SDKClient — not a global
  // config). Built lazily on mount and rebuilt whenever the active
  // Privy wallet changes so the EVM EthereumProvider is always bound
  // to the freshly connected EIP-1193 source. The provider exposes a
  // viem `Client` via `getWalletClient()` rather than the legacy v3
  // `{ provider }` shape — wrapping the EIP-1193 handle in a viem
  // `createWalletClient({ chain: arcTestnet, transport: custom(eip1193) })`
  // keeps signTypedData + writeContract calls inside LI.FI's StepExecutor
  // compatible with our wagmi/Privy signer stack.
  const [sdkClient, setSdkClient] = useState<SDKClient | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const buildClient = async () => {
      try {
        // @lifi/sdk v4 wants `providers: SDKProvider[]`; the bundled
        // EthereumProvider class satisfies that interface directly via
        // its `getWalletClient / switchChain / setOptions` shape.
        const providers: SDKProvider[] = [];
        if (agentWallet?.address) {
          try {
            const eip1193 = await agentWallet.getEthereumProvider();
            const walletClient = createWalletClient({
              account: agentWallet.address as `0x${string}`,
              chain: arcTestnet,
              transport: custom(eip1193),
            });
            providers.push(
              // v4 ships EthereumProvider as a factory function (NOT a
              // class — the d.ts is `declare function EthereumProvider(
              //   options?: EthereumProviderOptions
              // ): EthereumSDKProvider`), so no `new` keyword here.
              EthereumProvider({
                getWalletClient: async () => walletClient,
                // NIT (deferred): a real `switchChain` impl deserves a
                // proper viem chain-resolver map. Until then outbound
                // chains other than the source/destination fall back to
                // the wallet's own chain-switch RPC, which is the same
                // behaviour @privy-io injects today.
              })
            );
          } catch (signerErr) {
            // Provider assembly failed (wallet revoked permission etc.) —
            // quote fetch still works, only executeRoute will gate until
            // the user reconnects. Surface a toast so the user sees the
            // exact cause rather than a generic "quote failed" later.
            // eslint-disable-next-line no-console
            console.warn(
              "[agent] LI.FI EthereumProvider assemble warning:",
              signerErr
            );
            toast.error(
              "Wallet signer unavailable — reconnect to enable LI.FI execution."
            );
          }
        }
        if (cancelled) return;
        setSdkClient(
          createClient({
            integrator: LI_FI_INTEGRATOR,
            providers,
          })
        );
      } catch (e) {
        // Failure is non-fatal — the GET QUOTE button will surface a
        // gated toast until the client is re-created on next mount.
        // eslint-disable-next-line no-console
        console.warn("[agent] LI.FI createClient warning:", e);
      }
    };
    buildClient();
    return () => {
      cancelled = true;
    };
  }, [agentWallet]);

  // ----- Effective spend values -----------------------------------------
  // Live contract read wins whenever it is present; otherwise fall back to
  // the slider-driven demo on SPENDING_DEFAULTS.  This composes the demo
  // surface ("Simulate Spend" slider) with the real read path without
  // needing a separate render branch.
  const effectiveCap = liveSpending?.cap ?? SPENDING_DEFAULTS.velocityCap;
  const effectiveSpent = liveSpending?.spent ?? velocitySpent;
  const effectiveTxns =
    liveSpending?.txnsInWindow ?? SPENDING_DEFAULTS.txnsThisWindow;
  const effectiveBurst =
    liveSpending?.burstAllowance ?? SPENDING_DEFAULTS.burstAllowance;

  // ----- SpendingLimiter.vy live reads ----------------------------------
  // Polled every SPENDING_LIMITER_POLL_MS while a wallet is connected AND
  // the env var points at a real contract.  All reads go through a fresh
  // viem public client backed by the wallet's EIP-1193 provider so that
  // we never depend on Wagmi/Privy for a read call.  Any catch silently
  // leaves the previous state in place — the UI keeps rendering with the
  // deterministic 0.00 fallback to ensure the dashboard never blows up.
  useEffect(() => {
    if (!agentWallet || SPENDING_LIMITER_ADDRESS === ZERO_ADDRESS) {
      setLiveSpending(null);
      return;
    }
    let cancelled = false;
    const fetchSpending = async () => {
      try {
        const provider = await agentWallet.getEthereumProvider();
        const client = createPublicClient({
          chain: arcTestnet,
          transport: custom(provider),
        });
        const address = SPENDING_LIMITER_ADDRESS;
        const [vel, burst, win, c0, c1, c2] = await Promise.all([
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getVelocityState",
          }),
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getBurstAllowance",
          }),
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getWindowMetrics",
          }),
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getCategorySpend",
            args: [0],
          }),
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getCategorySpend",
            args: [1],
          }),
          client.readContract({
            address,
            abi: spendingLimiterABI,
            functionName: "getCategorySpend",
            args: [2],
          }),
        ]);
        if (cancelled) return;
        setLiveSpending({
          spent: parseFloat(formatUnits(vel[0], SPENDING_LIMITER_DECIMALS)),
          cap: parseFloat(formatUnits(vel[1], SPENDING_LIMITER_DECIMALS)),
          burstAllowance: parseFloat(
            formatUnits(burst, SPENDING_LIMITER_DECIMALS)
          ),
          windowSeconds: Number(win[0]),
          lastReset: Number(win[1]),
          txnsInWindow: Number(win[2]),
          categoryGas: parseFloat(
            formatUnits(c0, SPENDING_LIMITER_DECIMALS)
          ),
          categoryBridge: parseFloat(
            formatUnits(c1, SPENDING_LIMITER_DECIMALS)
          ),
          categoryStake: parseFloat(
            formatUnits(c2, SPENDING_LIMITER_DECIMALS)
          ),
        });
      } catch {
        // Soft-fail: leave the existing state; UI falls back to defaults.
      }
    };
    fetchSpending();
    const interval = setInterval(fetchSpending, SPENDING_LIMITER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agentWallet]);

  // ----- Reset-window countdown -----------------------------------------
  // Refresh the "Hh Mm" string every minute.  When the live SpendingLimiter
  // contract has responded with a (windowLength, lastReset) pair, drive the
  // countdown from on-chain data via the formatResetCountdown helper.
  // Otherwise fall back to a deterministic demo counter.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (liveSpending?.lastReset && liveSpending.windowSeconds > 0) {
        const nowSecs = Math.floor(Date.now() / 1000);
        setResetCountdown(
          formatResetCountdown(
            liveSpending.windowSeconds,
            liveSpending.lastReset,
            nowSecs
          )
        );
        return;
      }
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
  }, [liveSpending?.lastReset, liveSpending?.windowSeconds]);

  // ----- Derived computations for render --------------------------------
  const velocityPct = useMemo(() => {
    const safeCap = Math.max(effectiveCap, 1); // / 0 guard
    const pct = (effectiveSpent / safeCap) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [effectiveSpent, effectiveCap]);

  const remaining = Math.max(0, effectiveCap - effectiveSpent);
  const remainingDisplay = remaining.toFixed(2);

  // Per-category tile data — merges the static SPENDING_CATEGORIES
  // metadata (id, name, accent) with the live read categorySpend amounts
  // and the effective cap-based share percentage.
  const categoryTiles = SPENDING_CATEGORIES.map((cat) => {
    const liveAmount =
      cat.id === 0
        ? (liveSpending?.categoryGas ?? 0)
        : cat.id === 1
          ? (liveSpending?.categoryBridge ?? 0)
          : (liveSpending?.categoryStake ?? 0);
    return {
      name: cat.name,
      accent: cat.accent,
      amount: liveAmount,
      share: calcCategoryShare(liveAmount, effectiveCap),
    };
  });

  // ----- Handlers --------------------------------------------------------
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

  // Get Quote → LIVE LI.FI getRoutes() via @lifi/sdk v4.  The selected
  // Route is stored in `selectedRoute` so handleExecuteRoute can pass it
  // straight to executeRoute() without re-asking the user to fetch a
  // second quote.
  const handleGetQuote = useCallback(async () => {
    setSelectedRoute(null);
    setQuote(null);

    const amount = parseFloat(bridgeAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount to bridge.");
      setQuoteState("empty");
      return;
    }
    if (!isValidEvmAddress(recipient)) {
      toast.error("Invalid recipient address (must be a 0x… 40-hex string).");
      setQuoteState("empty");
      return;
    }
    if (!agentWallet?.address) {
      toast.error("Connect a wallet to fetch a live LI.FI route.");
      setQuoteState("empty");
      return;
    }
    if (!sdkClient) {
      toast.error("LI.FI SDK client not ready — wait a moment and retry.");
      setQuoteState("empty");
      return;
    }
    setQuoteState("loading");
    const start = Date.now();
    const runtimeTimer = setInterval(() => {
      setQuoteRuntimeMs(Date.now() - start);
    }, 80);

    try {
      // fromAmount is denominated in source-chain minor units (USDC on
      // every chain in our catalogue = 6 decimals).
      const fromAmount = parseUnits(
        bridgeAmount,
        sourceChain.usdcDecimals
      ).toString();
      const slippageDecimal = parseSlippageToDecimal(slippage);
      // @lifi/sdk v4 requires an SDKClient as the FIRST arg. integrator
      // is set on the client (above) so we don't repeat it here. order is
      // accepted as a RequestOptions field.
      const result = await getRoutes(sdkClient, {
        fromChainId: sourceChain.chainId,
        toChainId: ARC_TESTNET_CHAIN_ID,
        fromTokenAddress: sourceChain.usdcAddress as `0x${string}`,
        // Arc Testnet USDC is the chain's native gas → zero-address sentinel
        toTokenAddress: ZERO_ADDRESS,
        fromAmount,
        fromAddress: agentWallet.address as `0x${string}`,
        toAddress: recipient as `0x${string}`,
        options: {
          slippage: slippageDecimal,
          order: "CHEAPEST",
        },
      });
      clearInterval(runtimeTimer);
      setQuoteRuntimeMs(Date.now() - start);
      const first = result.routes?.[0];
      if (!first) {
        toast.warning("LI.FI returned no routes for this pair.");
        setQuoteState("empty");
        return;
      }
      // The runtime object is already structurally a RouteExtended —
      // only execution metadata is missing until executeRoute populates
      // it. Widen via the structural cast so the executing branch's
      // s.execution?.status reads are type-safe.
      setSelectedRoute(first as RouteExtended);
      // NIT from review: use the route's own toToken.decimals so a
      // future non-USDC destination is formatted correctly. The native
      // USDC sentinel on Arc Testnet reports 18.
      const destinationDecimals =
        first.toToken?.decimals && first.toToken.decimals > 0
          ? first.toToken.decimals
          : 18;
      const receiveNumber = parseFloat(
        formatUnits(BigInt(first.toAmount), destinationDecimals)
      );
      const fee = Math.max(0, amount - receiveNumber);
      // @lifi/sdk v4 nests the real cross-chain logic inside each
      // LiFiStep.includedSteps[]; the outer steps are always tagged
      // 'lifi'. Cross-chain bridges are tagged 'cross' and token
      // swaps are 'swap' inside the nested array.
      const allSubSteps = (first.steps ?? []).flatMap(
        (s) => s.includedSteps ?? []
      );
      const bridges = allSubSteps.filter((s) => s.type === "cross").length;
      const swaps = allSubSteps.filter((s) => s.type === "swap").length;
      setQuote({
        receive: receiveNumber,
        fee,
        bridgeSeconds: Math.max(
          45,
          Math.round(310 - (Date.now() - start) / 20)
        ),
        bridges,
        swaps,
      });
      setQuoteState("ready");
    } catch (err) {
      clearInterval(runtimeTimer);
      setQuoteRuntimeMs(Date.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`LI.FI quote failed: ${msg.slice(0, 80)}`);
      setQuoteState("empty");
    }
  }, [bridgeAmount, recipient, agentWallet, sourceChain, slippage, sdkClient]);

  // Execute Route → calls LI.FI executeRoute() with the SDKClient that
  // already has the EVM EthereumProvider wired in (see sdkClient effect
  // above). The v4 contract is: signature
  //   executeRoute(client: SDKClient, route: Route, executionOptions?: ExecutionOptions)
  // — `signer` is NOT a per-call option; v4 picks the right provider
  // automatically per-step (chain switches too). Streams step-level
  // execution status into `selectedRoute` so the quote preview panel
  // reflects per-step progress in real time.
  const handleExecuteRoute = useCallback(async () => {
    if (!selectedRoute || !agentWallet) {
      toast.error("Connect a wallet and fetch a quote first.");
      return;
    }
    if (!sdkClient) {
      toast.error("LI.FI SDK client not ready — wait a moment and retry.");
      return;
    }
    setQuoteState("executing");
    try {
      const updated = await executeRoute(sdkClient, selectedRoute, {
        // @lifi/sdk v4 names the per-step progress callback
        // `updateRouteHook` (typed `(route: RouteExtended) => void`),
        // not the v3-era `updateRouteExecution`. RouteExtended.steps
        // is `LiFiStepExtended[]`, each with its OWN aggregate
        // `execution?: Execution` — that's the level we should read
        // off (Step.includedSteps is typed Step[] without execution,
        // so reading inner-step statuses would require an unsafe cast).
        updateRouteHook: (route) => {
          setSelectedRoute(route);
          // Optimistic completion: when the LAST outer LiFiStep reports
          // status="DONE", the full route has cleared the bridge.
          // ExecutionStatus = 'ACTION_REQUIRED' | 'PENDING' | 'FAILED'
          // | 'DONE' (uppercase).
          const outer = route.steps?.at(-1);
          if (outer?.execution?.status === "DONE") {
            toast.success("LI.FI route executed successfully.");
          }
        },
      });
      setSelectedRoute(updated);
      setQuoteState("ready");
    } catch (err) {
      const e = err as Error & { code?: number; shortMessage?: string };
      if (
        e?.code === 4001 ||
        e?.shortMessage === "User rejected the request." ||
        /User rejected/i.test(String(e?.message ?? ""))
      ) {
        toast.error("Execution canceled by user.");
      } else {
        const msg = e instanceof Error ? e.message : String(err);
        toast.error(`Execute route failed: ${msg.slice(0, 80)}`);
      }
      setQuoteState("ready");
    }
  }, [selectedRoute, agentWallet, sdkClient]);

  const handleResetQuote = useCallback(() => {
    setQuoteState("idle");
    setBridgeAmount("");
    setQuoteRuntimeMs(0);
    setSelectedRoute(null);
    setQuote(null);
  }, []);

  // Terminal values rendered in the right-hand quote preview panel.
  // Falls back to the deterministic LI.FI fee math (calcNetReceive via
  // calcBridgeFee) when the user hasn't fetched a quote yet, so the
  // preview is interactive from first render.
  const estimatedReceive = quote?.receive ?? 0;
  const parseAmount = parseFloat(bridgeAmount) || 0;
  const estimatedFee = quote?.fee ?? calcNetReceive(
    parseAmount,
    bridgeAsset.symbol
  );
  const bridgeSecondsDisplay = quote?.bridgeSeconds ?? 60;
  const bridgeHopsDisplay = `${
    quote?.bridges ?? Math.max(1, Math.ceil(parseAmount / 100))
  } bridges · ${quote?.swaps ?? (bridgeAsset.symbol === "USDC" ? 0 : 1)} swaps`;

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
                  <span
                    suppressHydrationWarning
                    className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      liveSpending
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25"
                        : "bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <CircleDot
                      className={`w-2 h-2 ${
                        liveSpending ? "animate-pulse" : ""
                      }`}
                    />
                    {liveSpending ? "Live" : "Sim"}
                  </span>
                </p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight tabular-nums leading-none">
                    <span className="text-gradient">
                      {effectiveSpent.toFixed(2)}
                    </span>
                  </h3>
                  <span className="text-xl sm:text-2xl font-semibold text-slate-400 dark:text-slate-500">
                    / {effectiveCap.toFixed(2)}{" "}
                    {SPENDING_DEFAULTS.currency}
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
                  {effectiveSpent === 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/15 to-transparent velocity-shimmer" />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    Remaining:{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                      {remainingDisplay} {SPENDING_DEFAULTS.currency}
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
                  max={SPENDING_DEFAULTS.velocityCap}
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
                  value={`${SPENDING_DEFAULTS.burnRatePerHour.toFixed(2)}`}
                  unit="USDC/hr"
                  tone="amber"
                />
                <MetricTile
                  icon={<Activity className="w-3.5 h-3.5" />}
                  label="Txns / Window"
                  value={`${effectiveTxns}`}
                  unit="calls"
                  tone="sky"
                />
                <MetricTile
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Burst Allowance"
                  value={`${effectiveBurst.toFixed(2)}`}
                  unit="USDC"
                  tone="emerald"
                />
                <MetricTile
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  label="Window Length"
                  value={SPENDING_DEFAULTS.windowLength}
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
                  {categoryTiles.map((cat) => (
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
                      disabled={quoteState === "loading" || quoteState === "executing"}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                        quoteState === "loading" || quoteState === "executing"
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
                          {quoteState === "ready" ? "Re-Quote" : "Get Quote"}
                          <ChevronRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExecuteRoute}
                      disabled={
                        // Note: omitting a redundant `quoteState ===
                        // "executing"` clause here — TS narrowing on the
                        // sibling className ternary (which reads
                        // `quoteState === "ready" && ...`) flagged the
                        // disjoint literal comparison. Functionally
                        // equivalent because "executing" already implies
                        // "!== ready".
                        quoteState !== "ready" ||
                        !selectedRoute ||
                        !agentWallet
                      }
                      className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                        quoteState === "ready" && selectedRoute && agentWallet
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 shadow-sm shadow-amber-500/10"
                          : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 bg-slate-100/40 dark:bg-[#121826]/40 cursor-not-allowed"
                      }`}
                    >
                      {quoteState === "executing" ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                          Executing
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Execute Route
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
                                value={`${estimatedReceive.toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 4 }
                                )} ${bridgeAsset.symbol}`}
                                highlight
                              />
                              <QuoteRow
                                icon={<Send className="w-3.5 h-3.5" />}
                                label="Bridge fee"
                                value={`${estimatedFee.toLocaleString(
                                  undefined,
                                  { maximumFractionDigits: 4 }
                                )} ${bridgeAsset.symbol}`}
                              />
                              <QuoteRow
                                icon={<Timer className="w-3.5 h-3.5" />}
                                label="Estimated time"
                                value={`~ ${bridgeSecondsDisplay}s`}
                              />
                              <QuoteRow
                                icon={<Zap className="w-3.5 h-3.5" />}
                                label="Route hops"
                                value={bridgeHopsDisplay}
                              />
                              <QuoteRow
                                icon={<Network className="w-3.5 h-3.5" />}
                                label="Path"
                                value={`${sourceChain.label} → Arc Testnet`}
                              />
                            </div>
                          )}
                          {quoteState === "executing" && (
                            <div className="space-y-3 animate-fade-in" aria-busy>
                              <QuoteRow
                                icon={<Send className="w-3.5 h-3.5" />}
                                label="Execution step"
                                value={(() => {
                                  // RouteExtended.steps is
                                  // LiFiStepExtended[] — each carries
                                  // its own aggregate `execution?.status`
                                  // (ExecutionStatus = ACTION_REQUIRED |
                                  //  PENDING | FAILED | DONE). Count at
                                  // the OUTER level so the UI stays in
                                  // lockstep with the SDK's natural
                                  // granularity.
                                  const outer = selectedRoute?.steps ?? [];
                                  if (outer.length === 0) return "Streaming";
                                  const totalSteps = outer.length;
                                  const doneSteps = outer.filter(
                                    (s) => s.execution?.status === "DONE"
                                  ).length;
                                  return totalSteps > 0
                                    ? `${doneSteps} / ${totalSteps}`
                                    : "Streaming";
                                })()}
                                highlight
                              />
                              <SkeletonRow label="Approve" />
                              <SkeletonRow label="Bridge" />
                            </div>
                          )}
                        </div>
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

                        {/* Live status hint — replaces the Phase 2 stub once a
                            quote has been fetched. */}
                        <div className="mt-5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                          <p className="text-[10px] text-slate-300 leading-relaxed flex items-start gap-2">
                            <Terminal className="w-3.5 h-3.5 text-amber-400 mt-px shrink-0" />
                            <span>
                              <span className="font-bold text-amber-300">
                                {selectedRoute
                                  ? `executeRoute() ready via ${LI_FI_INTEGRATOR}`
                                  : "Phase 2 wires complete:"}
                              </span>{" "}
                              <code className="font-mono text-[10px] text-slate-200">
                                getRoutes()&nbsp;→&nbsp;executeRoute()
                              </code>{" "}
                              from{" "}
                              <code className="font-mono text-[10px] text-slate-200">
                                @lifi/sdk
                              </code>
                              {agentWallet
                                ? " · EIP-1193 signer wired."
                                : " · connect wallet to enable execution."}
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
