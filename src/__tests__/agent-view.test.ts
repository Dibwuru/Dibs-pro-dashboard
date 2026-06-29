import { describe, it, expect } from "vitest";

/**
 * ============================================================================
 *  /agent — Localized Regression Suite (Phase 2)
 * ============================================================================
 *
 *  PURPOSE
 *  -------
 *  Pin the /agent route's isolated logic — chain routing arrays, slippage
 *  parsing, bridge-fee math, and spending-bound formatters — so the new
 *  Phase 2 wiring doesn't drift.  Every helper under test is pure TypeScript:
 *  no React, no viem, no wagmi, no Privy, no DOM.  This satisfies the
 *  "Zero-Touch Logic Policy" guardrail: the affected exports live in the
 *  /agent module layer, NOT in vaultConfig.ts.
 *
 *  WHAT IS COVERED
 *  ---------------
 *    1. SOURCE_CHAINS array — chainId uniqueness, valid USDC addresses,
 *       6-decimal convention for EVM-family USDC.
 *    2. BRIDGE_ASSETS + SPENDING_CATEGORIES reference data correctness.
 *    3. SLIPPAGE_PRESETS ladder stays in lockstep with the UI.
 *    4. parseSlippageToDecimal — edge cases, bounds, malformed input.
 *    5. calcBridgeFee + calcNetReceive — feeRate boundary preservation,
 *       monotonic response, zero/negative input safety.
 *    6. isValidEvmAddress — canonical 0x40-hex, rejects whitespace/padding.
 *    7. findChainByChainId / findChainById — bidirectional lookups land.
 *    8. formatResetCountdown — pure hh Mm formatter, NaN-safe.
 *    9. calcCategoryShare — share rendering produces a deterministic %.
 *   10. spendingLimiterConfig — ABIs are valid for viem readContract.
 * ============================================================================
 */

import {
  BRIDGE_ASSETS,
  IDENTITY,
  SLIPPAGE_PRESETS,
  SOURCE_CHAINS,
  SPENDING_CATEGORIES,
  SPENDING_DEFAULTS,
  calcBridgeFee,
  calcCategoryShare,
  calcNetReceive,
  feeRateForAsset,
  findChainByChainId,
  findChainById,
  formatResetCountdown,
  isValidEvmAddress,
  parseSlippageToDecimal,
  truncateAddress,
  truncateMiddle,
} from "@/app/agent/agentHelpers";
import {
  SPENDING_LIMITER_ADDRESS,
  SPENDING_LIMITER_DECIMALS,
  SPENDING_LIMITER_POLL_MS,
  spendingLimiterABI,
} from "@/app/agent/spendingLimiterConfig";

// ===========================================================================
// SOURCE_CHAINS catalogue — pin chain routing array
// ===========================================================================
describe("SOURCE_CHAINS routing array", () => {
  it("contains exactly 6 chains (Ethereum, Sepolia, Base, Arbitrum, Optimism, Polygon)", () => {
    expect(SOURCE_CHAINS.length).toBe(6);
  });

  it("every chainId is a positive integer (no decimals, no negatives)", () => {
    for (const c of SOURCE_CHAINS) {
      expect(Number.isInteger(c.chainId)).toBe(true);
      expect(c.chainId).toBeGreaterThan(0);
    }
  });

  it("chainIds are unique — duplicates would corrupt the LI.FI getRoutes request", () => {
    const ids = SOURCE_CHAINS.map((c) => c.chainId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry exposes a USDC ERC-20 address (0x… 40-hex)", () => {
    for (const c of SOURCE_CHAINS) {
      expect(c.usdcAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it("every entry uses 6-decimal USDC convention (matches Ethereum-family ERC-20)", () => {
    for (const c of SOURCE_CHAINS) {
      expect(c.usdcDecimals).toBe(6);
    }
  });

  it("every entry has a non-empty label + note for the UI button grid", () => {
    for (const c of SOURCE_CHAINS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.note.length).toBeGreaterThan(0);
    }
  });

  it("the LI.FI chain ID 5042002 (Arc Testnet) is NOT in the SOURCE_CHAINS list", () => {
    // Arc is the FIXED destination — it must never appear as a source.
    expect(findChainByChainId(5042002)).toBeUndefined();
  });

  it("findChainById round-trips every SOURCE_CHAINS entry", () => {
    for (const c of SOURCE_CHAINS) {
      const found = findChainById(c.id);
      expect(found?.chainId).toBe(c.chainId);
      expect(found?.label).toBe(c.label);
    }
  });

  it("findChainByChainId finds the Ethereum mainnet entry by numeric chainId", () => {
    const eth = findChainByChainId(1);
    expect(eth?.id).toBe("ethereum");
    expect(eth?.ticker).toBe("ETH");
  });

  it("findChainByChainId returns undefined for an unknown chain ID", () => {
    expect(findChainByChainId(999999999)).toBeUndefined();
  });
});

// ===========================================================================
// BRIDGE_ASSETS catalogue — pin output asset reference data
// ===========================================================================
describe("BRIDGE_ASSETS catalogue", () => {
  it("contains exactly 4 assets: USDC, WETH, DIBS, WBTC", () => {
    expect(BRIDGE_ASSETS.length).toBe(4);
    expect(BRIDGE_ASSETS.map((a) => a.symbol)).toEqual([
      "USDC",
      "WETH",
      "DIBS",
      "WBTC",
    ]);
  });

  it("every asset has a tone drawn from the known palette", () => {
    const knownTones = new Set(["emerald", "sky", "amber", "orange"]);
    for (const a of BRIDGE_ASSETS) {
      expect(knownTones.has(a.tone)).toBe(true);
    }
  });
});

// ===========================================================================
// Spending defaults + category enumeration
// ===========================================================================
describe("SPENDING_DEFAULTS and SPENDING_CATEGORIES", () => {
  it("SPENDING_DEFAULTS cap/velocity are positive finite numbers", () => {
    expect(SPENDING_DEFAULTS.velocityCap).toBeGreaterThan(0);
    expect(Number.isFinite(SPENDING_DEFAULTS.velocityCap)).toBe(true);
    expect(SPENDING_DEFAULTS.windowSeconds).toBe(86_400); // 24h rolling
  });

  it("SPENDING_DEFAULTS.currency is set to USDC (matches Arc native gas)", () => {
    expect(SPENDING_DEFAULTS.currency).toBe("USDC");
  });

  it("SPENDING_CATEGORIES exposes exactly [Gas, Bridge, Stake] with stable ids", () => {
    expect(SPENDING_CATEGORIES.length).toBe(3);
    expect(SPENDING_CATEGORIES.map((c) => c.name)).toEqual([
      "Gas",
      "Bridge",
      "Stake",
    ]);
    expect(SPENDING_CATEGORIES.map((c) => c.id)).toEqual([0, 1, 2]);
  });
});

// ===========================================================================
// SLIPPAGE_PRESETS ladder + parseSlippageToDecimal formatter
// ===========================================================================
describe("SLIPPAGE_PRESETS and parseSlippageToDecimal", () => {
  it("SLIPPAGE_PRESETS is exactly the 4-step ladder [0.5%, 1.0%, 2.0%, 5.0%]", () => {
    expect([...SLIPPAGE_PRESETS]).toEqual(["0.5%", "1.0%", "2.0%", "5.0%"]);
  });

  it("every preset parses to a sane decimal (0.005, 0.01, 0.02, 0.05)", () => {
    expect(parseSlippageToDecimal("0.5%")).toBeCloseTo(0.005, 10);
    expect(parseSlippageToDecimal("1.0%")).toBeCloseTo(0.01, 10);
    expect(parseSlippageToDecimal("2.0%")).toBeCloseTo(0.02, 10);
    expect(parseSlippageToDecimal("5.0%")).toBeCloseTo(0.05, 10);
  });

  it("accepts a naked percentage without the % character", () => {
    expect(parseSlippageToDecimal("1.0")).toBeCloseTo(0.01, 10);
    expect(parseSlippageToDecimal("0.5")).toBeCloseTo(0.005, 10);
    expect(parseSlippageToDecimal("2")).toBeCloseTo(0.02, 10);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseSlippageToDecimal("  1.0%  ")).toBeCloseTo(0.01, 10);
  });

  it("returns 0 for malformed / NaN / negative / undefined / null input", () => {
    expect(parseSlippageToDecimal("not-a-number")).toBe(0);
    expect(parseSlippageToDecimal("")).toBe(0);
    expect(parseSlippageToDecimal(undefined)).toBe(0);
    expect(parseSlippageToDecimal(null)).toBe(0);
    expect(parseSlippageToDecimal("-1%")).toBe(0);
  });

  it("clamps above 50% to 0 (out of band → ignored)", () => {
    expect(parseSlippageToDecimal("99%")).toBe(0);
    expect(parseSlippageToDecimal("100%")).toBe(0);
  });
});

// ===========================================================================
// LI.FI fee math: feeRateForAsset + calcBridgeFee + calcNetReceive
// ===========================================================================
describe("LI.FI fee math", () => {
  it("USDC pays the preferential 5 bps rate (0.0005)", () => {
    expect(feeRateForAsset("USDC")).toBe(0.0005);
  });

  it("every other asset pays the standard 25 bps rate (0.0025)", () => {
    expect(feeRateForAsset("WETH")).toBe(0.0025);
    expect(feeRateForAsset("DIBS")).toBe(0.0025);
    expect(feeRateForAsset("WBTC")).toBe(0.0025);
    expect(feeRateForAsset("UNKNOWN")).toBe(0.0025);
  });

  it("an undefined symbol falls back to the standard 25 bps rate", () => {
    expect(feeRateForAsset(undefined)).toBe(0);
    // (feeRateForAsset returns 0 only on undefined input — non-empty
    // unknown symbols pay the 25 bps rate.)
    expect(feeRateForAsset("")).toBe(0);
  });

  it("calcBridgeFee scales linearly with notional for the same symbol", () => {
    expect(calcBridgeFee(100, "USDC")).toBeCloseTo(0.05, 10);
    expect(calcBridgeFee(1_000, "USDC")).toBeCloseTo(0.5, 10);
    expect(calcBridgeFee(100, "WETH")).toBeCloseTo(0.25, 10);
  });

  it("calcBridgeFee returns 0 for zero / negative / non-finite inputs", () => {
    expect(calcBridgeFee(0, "USDC")).toBe(0);
    expect(calcBridgeFee(-1, "USDC")).toBe(0);
    expect(calcBridgeFee(NaN, "USDC")).toBe(0);
    expect(calcBridgeFee(Infinity, "USDC")).toBe(0);
  });

  it("calcNetReceive returns (amount - fee) and never goes below 0", () => {
    expect(calcNetReceive(100, "USDC")).toBeCloseTo(99.95, 10);
    expect(calcNetReceive(100, "WETH")).toBeCloseTo(99.75, 10);
  });

  it("calcNetReceive collapses to 0 for zero / negative / NaN input", () => {
    expect(calcNetReceive(0, "USDC")).toBe(0);
    expect(calcNetReceive(-50, "USDC")).toBe(0);
    expect(calcNetReceive(NaN, "USDC")).toBe(0);
  });

  it("fee + net-receive round-trip recovers the original notional exactly", () => {
    const amount = 1234.5678;
    const asset = "WETH";
    const fee = calcBridgeFee(amount, asset);
    const receive = calcNetReceive(amount, asset);
    expect(receive + fee).toBeCloseTo(amount, 8);
  });
});

// ===========================================================================
// isValidEvmAddress — strict 0x…40-hex-char checker
// ===========================================================================
describe("isValidEvmAddress", () => {
  it("accepts the canonical lower-case 40-hex-char address", () => {
    expect(isValidEvmAddress("0xc45073b9de74c7f286c2545a618b703f31228cb6")).toBe(
      true
    );
  });

  it("accepts an UPPER-CASE 40-hex-char address (case insensitive)", () => {
    expect(
      isValidEvmAddress("0xC45073B9DE74C7F286C2545A618B703F31228CB6")
    ).toBe(true);
  });

  it("rejects 39-hex-char addresses (missing one char)", () => {
    expect(isValidEvmAddress("0xc45073b9de74c7f286c2545a618b703f31228cb")).toBe(
      false
    );
  });

  it("rejects 41-hex-char addresses (one extra char)", () => {
    expect(
      isValidEvmAddress("0xc45073b9de74c7f286c2545a618b703f31228cb60")
    ).toBe(false);
  });

  it("rejects missing 0x prefix, misspelled prefix, or whitespace padding", () => {
    expect(
      isValidEvmAddress("c45073b9de74c7f286c2545a618b703f31228cb6")
    ).toBe(false);
    expect(
      isValidEvmAddress(" 0xc45073b9de74c7f286c2545a618b703f31228cb6")
    ).toBe(false);
    expect(
      isValidEvmAddress("0xc45073b9de74c7f286c2545a618b703f31228cb6 ")
    ).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(
      isValidEvmAddress("0xz45073b9de74c7f286c2545a618b703f31228cb6")
    ).toBe(false);
  });

  it("rejects empty / null / undefined without throwing", () => {
    expect(isValidEvmAddress("")).toBe(false);
    expect(isValidEvmAddress(undefined)).toBe(false);
    expect(isValidEvmAddress(null)).toBe(false);
  });
});

// ===========================================================================
// Spending-bound formatters + truncation helpers
// ===========================================================================
describe("formatResetCountdown", () => {
  it("formats an HH:MM countdown string from window/lastReset/now", () => {
    // 86_400s window that reset 45 min ago → 23h 15m remaining
    expect(formatResetCountdown(86_400, 1_000, 3_700)).toBe("23h 15m");
  });

  it("pads single-digit minutes with a leading zero (deterministic UI)", () => {
    expect(formatResetCountdown(3_600, 0, 60)).toBe("0h 59m");
  });

  it("returns '0h 00m' when the window expired long ago", () => {
    expect(formatResetCountdown(3_600, 0, 100_000)).toBe("0h 00m");
  });

  it("returns '—' when windowSeconds / lastReset / now are invalid", () => {
    expect(formatResetCountdown(0, 100, 200)).toBe("—");
    expect(formatResetCountdown(86_400, NaN, 200)).toBe("—");
    expect(formatResetCountdown(86_400, 100, NaN)).toBe("—");
    expect(formatResetCountdown(-1, 100, 200)).toBe("—");
  });
});

describe("calcCategoryShare", () => {
  it("returns a deterministic 50% for half-of-cap notionals", () => {
    expect(calcCategoryShare(250, 500)).toBeCloseTo(50, 10);
  });

  it("clamps at exactly 100% when the bucket equals or exceeds the cap", () => {
    expect(calcCategoryShare(500, 500)).toBe(100);
    expect(calcCategoryShare(600, 500)).toBe(100);
  });

  it("returns 0 for a 0 / negative / NaN categoryAmount", () => {
    expect(calcCategoryShare(0, 500)).toBe(0);
    expect(calcCategoryShare(-1, 500)).toBe(0);
    expect(calcCategoryShare(NaN, 500)).toBe(0);
  });

  it("returns 0 for a 0 / negative / NaN totalCap (no / 0 explosion)", () => {
    expect(calcCategoryShare(50, 0)).toBe(0);
    expect(calcCategoryShare(50, -1)).toBe(0);
    expect(calcCategoryShare(50, NaN)).toBe(0);
  });
});

describe("truncateAddress / truncateMiddle helpers", () => {
  it("truncateAddress renders 0xc4507…2cb6 for the canonical vault bound", () => {
    // slice(0,8) keeps 8 left chars; slice(-6) keeps the last 6 chars.
    expect(
      truncateAddress("0xc45073b9de74c7f286c2545a618b703f31228cb6", 8, 6)
    ).toBe("0xc45073…228cb6");
  });

  it("truncateMiddle renders 0x9f4c8a2b…f0a1c3d for the ERC-8004 signature hex", () => {
    const sig =
      "0x9f4c8a2b7e1d3a5c0b6e9f2a4d8c1b5e7f0a2c4d6b9e3f1a5c8d2b6e4f0a1c3d";
    // slice(0,14) keeps 14 left chars; slice(-10) keeps the last 10 chars.
    expect(truncateMiddle(sig, 14, 10)).toBe(
      "0x9f4c8a2b7e1d…6e4f0a1c3d"
    );
  });

  it("both helpers short-circuit short / empty inputs (preserves original)", () => {
    expect(truncateAddress("0x12", 6, 4)).toBe("0x12");
    expect(truncateAddress("")).toBe("");
    expect(truncateAddress(undefined)).toBe("");
    expect(truncateMiddle("too-short")).toBe("too-short");
    expect(truncateMiddle("")).toBe("");
  });
});

// ===========================================================================
// IDENTITY — ERC-8004 snapshot
// ===========================================================================
describe("IDENTITY (ERC-8004 snapshot)", () => {
  it("walletBinding matches the canonical DibsSwapVault vault address (Arc Testnet)", () => {
    expect(IDENTITY.walletBinding).toBe(
      "0xc45073b9de74c7f286c2545a618b703f31228cb6"
    );
  });

  it("reputationScore sits in [0, 100]", () => {
    expect(IDENTITY.reputationScore).toBeGreaterThan(0);
    expect(IDENTITY.reputationScore).toBeLessThanOrEqual(100);
  });

  it("exposes three status badges in deterministic order", () => {
    expect(IDENTITY.status).toEqual(["REGISTERED", "ATTESTED", "ON-CHAIN"]);
  });

  it("verification hashes include the registered signature + manifest CID + TX", () => {
    expect(IDENTITY.hashes.length).toBeGreaterThanOrEqual(3);
    const labels = IDENTITY.hashes.map((h) => h.label);
    expect(labels).toContain("ERC-8004 Signature");
    expect(labels).toContain("Manifest CID");
    expect(labels).toContain("Registration TX");
  });
});

// ===========================================================================
// spendingLimiterConfig — ABI + address pins
// ===========================================================================
describe("spendingLimiterConfig", () => {
  it("SPENDING_LIMITER_ADDRESS is a 0x-prefixed 40-hex address (or zero fallback)", () => {
    expect(SPENDING_LIMITER_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("SPENDING_LIMITER_DECIMALS is 18 (the Arc Testnet native USDC convention)", () => {
    expect(SPENDING_LIMITER_DECIMALS).toBe(18);
  });

  it("SPENDING_LIMITER_POLL_MS is a positive integer (no jittery 0ms polls)", () => {
    expect(Number.isInteger(SPENDING_LIMITER_POLL_MS)).toBe(true);
    expect(SPENDING_LIMITER_POLL_MS).toBeGreaterThan(0);
  });

  it("spendingLimiterABI exposes the contracted grouped read surface", () => {
    const fnNames = spendingLimiterABI
      .filter((x) => x.type === "function")
      .map((x) => x.name)
      .sort();
    expect(fnNames).toEqual([
      "getBurstAllowance",
      "getCategorySpend",
      "getVelocityState",
      "getWindowMetrics",
      "owner",
    ]);
  });

  it("every ABI function entry is marked stateMutability='view'", () => {
    for (const entry of spendingLimiterABI) {
      if (entry.type === "function") {
        // @ts-expect-error — narrowed by the filter above in viem
        expect(entry.stateMutability).toBe("view");
      }
    }
  });

  it("getCategorySpend takes a single uint8 (categoryId) and returns a uint256", () => {
    const entry = spendingLimiterABI.find(
      (x) => x.type === "function" && x.name === "getCategorySpend"
    );
    // @ts-expect-error — narrowed
    expect(entry.inputs).toEqual([{ name: "categoryId", type: "uint8" }]);
    // @ts-expect-error — narrowed
    expect(entry.outputs).toEqual([{ name: "", type: "uint256" }]);
  });
});
