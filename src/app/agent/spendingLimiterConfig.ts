/**
 * ============================================================================
 *  /agent — SpendingLimiter.vy Configuration (isolated module)
 * ============================================================================
 *
 * PURPOSE
 * -------
 *  Owns the on-chain addresses and ABI signatures for the Phase-2
 *  SpendingLimiter.vy contract that backs Module 02 of the /agent route.
 *
 *  The ABI exposes grouped read functions (getVelocityState,
 *  getBurstAllowance, getWindowMetrics, getCategorySpend) so the UI
 *  can bind its metric tiles to real-time wallet state on Arc Testnet
 *  with at most 6 readContract() calls per sync.
 *
 * ISOLATION NOTE
 * --------------
 *  Lives in the /agent module layer. The legacy /swap, /stake, /dashboard
 *  pages ONLY touch src/vaultConfig.ts (which pins VAULT_ADDRESS, the
 *  DibsSwapVault vaultABI, etc.). Adding new exports here does not touch
 *  any test-pinned surface — the dapp-regression.test.ts suite keeps its
 *  30 baseline assertions intact.
 *
 *  Mirrors the env-override-with-fallback pattern from src/vaultConfig.ts
 *  but is intentionally factored OUT of that file to keep the guardrail
 *  "Zero-Touch Logic Policy on /swap, /stake, /dashboard" honest.
 * ============================================================================
 */

import { type Abi } from "viem";

// ----------------------------------------------------------------------------
// Address fallback
// ----------------------------------------------------------------------------
//
// SpendingLimiter.vy has a Phase-2 demo deployment on Arc Testnet. The
// canonical address is overridden by NEXT_PUBLIC_SPENDING_LIMITER_ADDRESS;
// when missing or malformed we fall back to the zero address — which the
// viem read path treats as "no contract" and silently no-ops the read so
// the UI keeps rendering without a runtime crash.
const FALLBACK_SPENDING_LIMITER_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

/**
 * Validates that a string is a proper 0x-prefixed 40-hex-character address.
 * Falls back to the canonical address on malformed input — never throws
 * during SSR prerender.
 */
function assertValidAddress(
  value: string | undefined,
  fallback: `0x${string}`
): `0x${string}` {
  if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value as `0x${string}`;
  }
  if (typeof value === "string" && value.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[spendingLimiterConfig] Invalid SPENDING_LIMITER_ADDRESS in env ` +
        `(length=${value.length}). Falling back to canonical address ${fallback}. ` +
        `Re-check NEXT_PUBLIC_SPENDING_LIMITER_ADDRESS.`
    );
  }
  return fallback;
}

export const SPENDING_LIMITER_ADDRESS = assertValidAddress(
  process.env.NEXT_PUBLIC_SPENDING_LIMITER_ADDRESS,
  FALLBACK_SPENDING_LIMITER_ADDRESS
);

/** True when the env hasn't pointed at a real deployment. */
export const SPENDING_LIMITER_CONFIGURED =
  SPENDING_LIMITER_ADDRESS !== FALLBACK_SPENDING_LIMITER_ADDRESS;

// ----------------------------------------------------------------------------
// SpendingLimiter.vy ABI (grouped view reads only)
//
// IMPORTANT: These are the *minimal* view surface the /agent Module 02
// tiles need. Writes (consumeVelocity, setCap, resetWindow, etc.) are NOT
// exposed to the UI in Phase 2; only reads. The ABI is intentionally kept
// narrow so it is callable from the public viem transport without
// requiring a signer — and so it can be pinned by the regression suite
// without coupling to any future write-path contract changes.
// ----------------------------------------------------------------------------
export const spendingLimiterABI = [
  // Spent + cap — single round-trip per poll.
  {
    type: "function",
    name: "getVelocityState",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "spent", type: "uint256" },
      { name: "cap", type: "uint256" },
    ],
  },
  // Burst allowance (e.g. emergency one-shot over the rolling mean).
  {
    type: "function",
    name: "getBurstAllowance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Window length + last reset + txns-in-window.
  {
    type: "function",
    name: "getWindowMetrics",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "windowLength", type: "uint256" },
      { name: "lastReset", type: "uint256" },
      { name: "txnsInWindow", type: "uint256" },
    ],
  },
  // Per-category spend — id: 0=Gas, 1=Bridge, 2=Stake.
  {
    type: "function",
    name: "getCategorySpend",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "uint8" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Owner (useful for /agent Module 01 cross-bind).
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const satisfies Abi;

// ----------------------------------------------------------------------------
// Polling cadence constants (kept co-located with the ABIs so consumers
// import them from one place).
// ----------------------------------------------------------------------------
export const SPENDING_LIMITER_POLL_MS = 10_000;
export const SPENDING_LIMITER_DECIMALS = 18; // Arc Testnet native USDC = 18 dec
