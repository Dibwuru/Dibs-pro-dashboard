/**
 * ============================================================================
 *  /agent — Pure Helpers & Reference Data
 * ============================================================================
 *
 * PURPOSE
 * -------
 *  Holds every *pure* value the /agent route needs:
 *    - Source-chain catalogue (what LI.FI can route FROM)
 *    - Bridge asset catalogue (what LI.FI pays out IN)
 *    - Slippage presets
 *    - Spending-limiter defaults (fallback when no live contract read)
 *    - Formatters + math + address/chain validators
 *
 * This module is intentionally kept framework-free: no React, no viem, no
 * wagmi, no @privy-io imports. The vitest regression suite imports it
 * directly to assert that chain routing arrays + spending bounds are
 * well-formed and that fee/slippage math is monotonic.
 *
 * ISOLATION NOTE
 * --------------
 *  Lives in the /agent module layer (src/app/agent/) so it never bleeds
 *  into the legacy /swap, /stake, or /dashboard states. Adding new exports
 *  to this file changes ZERO behaviour in the test-pinned
 *  dapp-regression.test.ts suite.
 * ============================================================================
 */

// =========================================================================
// SOURCE-CHAINS — chainId + USDC contract address per source.
// Each entry is what LI.FI's getRoutes() needs: fromChainId (number) and
// fromTokenAddress (string, lowercase 0x... or 'USDC' symbol). Decimals are
// picked per Vyper/ERC-20 convention (Ethereum-family USDC = 6 decimals).
// =========================================================================
export const SOURCE_CHAINS = [
  {
    id: "ethereum",
    label: "Ethereum",
    chainId: 1,
    ticker: "ETH",
    note: "L1 Settlement",
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  {
    id: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
    ticker: "ETH",
    note: "Testnet",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdcDecimals: 6,
  },
  {
    id: "base",
    label: "Base",
    chainId: 8453,
    ticker: "ETH",
    note: "OP Stack",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    chainId: 42161,
    ticker: "ETH",
    note: "L2 Rollup",
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  {
    id: "optimism",
    label: "Optimism",
    chainId: 10,
    ticker: "ETH",
    note: "OP Stack",
    usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
  },
  {
    id: "polygon",
    label: "Polygon",
    chainId: 137,
    ticker: "MATIC",
    note: "PoS Sidechain",
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcDecimals: 6,
  },
] as const;

export type SourceChain = (typeof SOURCE_CHAINS)[number];

// =========================================================================
// BRIDGE ASSETS — what the user wants to MOVE across chains.
// Note: USDC is the canonical bridge asset (matches Arc's native gas).
// =========================================================================
export const BRIDGE_ASSETS = [
  { symbol: "USDC", note: "Native Bridge Asset", tone: "emerald" },
  { symbol: "WETH", note: "Wrapped Native Gas", tone: "sky" },
  { symbol: "DIBS", note: "Settlement Token", tone: "amber" },
  { symbol: "WBTC", note: "Bitcoin-backed", tone: "orange" },
] as const;

export type BridgeAsset = (typeof BRIDGE_ASSETS)[number];

// =========================================================================
// SLIPPAGE PRESETS — canonical 0.5 / 1.0 / 2.0 / 5.0 % ladder.
// =========================================================================
export const SLIPPAGE_PRESETS = ["0.5%", "1.0%", "2.0%", "5.0%"] as const;

// =========================================================================
// SPENDING LIMITER — defaults + per-bucket metadata.
// (id maps to the Vyper contract's category enum: 0=Gas, 1=Bridge, 2=Stake)
// =========================================================================
export const SPENDING_DEFAULTS = {
  velocitySpent: 0,
  velocityCap: 500,
  currency: "USDC",
  burstAllowance: 50,
  windowSeconds: 86_400, // 24 h rolling
  txnsThisWindow: 0,
  windowLength: "24h rolling",
  resetWindowRemaining: "24h 00m",
  // burnRatePerHour is a deterministic fallback used by the MetricTile
  // stamp until SpendingLimiter.vy responds with a live (spent,
  // lastReset, windowSeconds) tuple. The /agent page overrides this
  // streak-by-streak via liveSpending?.spent / elapsed-hours — see the
  // effectiveBurnRate derivation in src/app/agent/page.tsx.
  burnRatePerHour: 0,
} as const;

export const SPENDING_CATEGORIES = [
  { id: 0, name: "Gas", accent: "amber" },
  { id: 1, name: "Bridge", accent: "emerald" },
  { id: 2, name: "Stake", accent: "sky" },
] as const;

// =========================================================================
// AGENT IDENTITY — deterministic profile metadata for ERC-8004 registration.
// (WYSIWYG snapshot; status badges are intentionally pinned.)
// =========================================================================
export const IDENTITY = {
  agentId: "AGENT-0042",
  displayName: "ARCTOR Relay Node",
  walletBinding: "0xc45073b9de74c7f286c2545a618b703f31228cb6",
  registeredAt: "2026-06-12 · 14:23 UTC",
  reputationScore: 98.7,
  status: ["REGISTERED", "ATTESTED", "ON-CHAIN"] as const,
  hashes: [
    {
      label: "ERC-8004 Signature",
      value:
        "0x9f4c8a2b7e1d3a5c0b6e9f2a4d8c1b5e7f0a2c4d6b9e3f1a5c8d2b6e4f0a1c3d",
    },
    {
      label: "Manifest CID",
      value: "ipfs://bafybeiabc7d3xqy2vc4kyz5mnqxuh4uc7zqxp3wjlzhsrg5vkndwuvg6ay",
    },
    {
      label: "Registration TX",
      value:
        "0x7e2c1b9a4f6d8c0e2b5a7f9d3c1b6e4f2a8d0c5e9b3f1a7c2d4e6b0a8f3c5d1e",
    },
  ],
} as const;

// =========================================================================
// Helpers
// =========================================================================

/**
 * Parses any slippage-token string ("1.0%", "30", "0.5  ") into a decimal
 * fraction validated against 0..50 % bound. Returns 0 for malformed input.
 *
 * Examples:
 *   parseSlippageToDecimal("1.0%") === 0.01
 *   parseSlippageToDecimal("0.5")  === 0.005
 *   parseSlippageToDecimal("nope") === 0
 */
export function parseSlippageToDecimal(input: string | undefined | null): number {
  if (typeof input !== "string") return 0;
  const cleaned = input.replace(/%/g, "").trim();
  if (!cleaned) return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 50) return 0;
  return num / 100;
}

/**
 * Returns the deterministic LI.FI fee rate for a given output asset symbol.
 * USDC gets the favourable 5 bps rate; everything else pays 25 bps.
 */
export function feeRateForAsset(symbol: string | undefined): number {
  if (!symbol) return 0;
  return symbol === "USDC" ? 0.0005 : 0.0025;
}

/** Computes the gross LI.FI fee paid on a notional amount. */
export function calcBridgeFee(amount: number, symbol: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount * feeRateForAsset(symbol);
}

/** Net amount the user receives after the LI.FI bridge fee. */
export function calcNetReceive(amount: number, symbol: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(0, amount - calcBridgeFee(amount, symbol));
}

/**
 * Strict EVM address validator. Accepts only the canonical
 *   "0x" + 40 hex characters
 * shape with no leading/trailing whitespace. Empty / short / malformed
 * inputs are rejected (return false) — never throw. Importantly, the
 * regex does NOT trim before matching, so any whitespace at the edges
 * is reported as invalid (matches the test expectations and the
 * actual /agent-page UX where callers do not pre-trim).
 */
export function isValidEvmAddress(addr: string | undefined | null): boolean {
  if (typeof addr !== "string") return false;
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/** Finds a source-chain by its LI.FI chainId (numeric). */
export function findChainByChainId(
  chainId: number
): SourceChain | undefined {
  return SOURCE_CHAINS.find((c) => c.chainId === chainId);
}

/** Finds a source-chain by its UI slug (e.g. "ethereum"). */
export function findChainById(id: string): SourceChain | undefined {
  return SOURCE_CHAINS.find((c) => c.id === id);
}

/**
 * Computes the "14h 23m" reset-countdown string for a 24h rolling window.
 * Uses pure inputs (windowLength seconds, lastReset unix-seconds,
 * now unix-seconds) so the function is testable in node:assert style.
 */
export function formatResetCountdown(
  windowSeconds: number,
  lastResetTimestamp: number,
  nowSeconds: number
): string {
  if (
    !Number.isFinite(windowSeconds) ||
    !Number.isFinite(lastResetTimestamp) ||
    !Number.isFinite(nowSeconds) ||
    windowSeconds <= 0
  ) {
    return "—";
  }
  const elapsed = Math.max(0, nowSeconds - lastResetTimestamp);
  const remaining = Math.max(0, windowSeconds - elapsed);
  const hh = Math.floor(remaining / 3600);
  const mm = Math.floor((remaining % 3600) / 60);
  return `${hh}h ${mm.toString().padStart(2, "0")}m`;
}

/**
 * Computes an interpolated share percentage of a category bucket. Avoids
 * the "100/0 → NaN" trap by treating a zero totalCap as 0%.
 */
export function calcCategoryShare(
  categoryAmount: number,
  totalCap: number
): number {
  if (!Number.isFinite(categoryAmount) || categoryAmount <= 0) return 0;
  if (!Number.isFinite(totalCap) || totalCap <= 0) return 0;
  return Math.min(100, (categoryAmount / totalCap) * 100);
}

/**
 * Hex-middle truncation. Mirrors the helper the /agent page already uses
 * inline ("0x9f4c…1c3d") but exported so the regression suite can pin it.
 */
export function truncateMiddle(
  value: string,
  head = 14,
  tail = 10
): string {
  if (typeof value !== "string") return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Address truncation. Mirrors the inline helper in src/app/agent/page.tsx
 * ("0xc4507…2cb6") and the canonical src/lib/format.ts#formatAddress shape.
 */
export function truncateAddress(
  addr: string | undefined | null,
  head = 6,
  tail = 4
): string {
  if (typeof addr !== "string" || !addr) return addr || "";
  if (addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/**
 * Tone/colour palette used by the agent dashboard cards. Pure lookup so the
 * regression suite can pin the mapping without exposing the React classes.
 */
export const ACCENT_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  amber: "amber",
  emerald: "emerald",
  sky: "sky",
  violet: "violet",
  orange: "orange",
});
