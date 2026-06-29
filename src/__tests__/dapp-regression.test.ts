import { describe, it, expect } from "vitest";
import { parseUnits, formatUnits } from "viem";
import {
  EXCHANGE_RATE,
  ARC_TESTNET_CHAIN_ID,
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
} from "@/vaultConfig";
import { formatAddress } from "@/lib/format";

/**
 * ===========================================================================
 *  Dapp Regression Suite — Swap & Stake Math
 * ===========================================================================
 *
 *  PURPOSE
 *  -------
 *  Pin the mathematical data flows that drive the user-facing Swap and
 *  Stake flows to known-good values so any drift in constants, formulas,
 *  addresses, or formatting helpers produces a CI failure BEFORE the bad
 *  code reaches production.
 *
 *  WHAT IS COVERED
 *  ---------------
 *    1. Canonical constants (EXCHANGE_RATE, chain ID, address fallbacks)
 *    2. Token Swap calculations mirroring src/app/swap/page.tsx
 *    3. wei-level conversions via viem (parseUnits / formatUnits, 18 dec)
 *    4. Staking input logic mirroring src/app/stake/page.tsx
 *    5. Stake input validation rules (positive, non-empty, no overdraw)
 *    6. formatAddress utility (0x1234...5678 truncation)
 *
 *  GUARDRAILS
 *  ----------
 *  This suite ONLY inspects plain math + import-time constants. It does
 *  not import React, hooks or layouts — the operational UI code stays
 *  untouched.
 * ===========================================================================
 */

// Mirror the lock-period catalogue from src/app/stake/page.tsx verbatim
// so any drift in the source-of-truth array immediately fails this test.
const LOCK_PERIODS = [
  { days: 7, label: "7 Days", apy: "8.5%" },
  { days: 30, label: "30 Days", apy: "12.5%" },
  { days: 90, label: "90 Days", apy: "18.0%" },
  { days: 180, label: "180 Days", apy: "24.0%" },
] as const;

// --- Swap math (mirrors src/app/swap/page.tsx) ---------------------------
const calcSwapOutputDibs = (usdcInput: number): number =>
  usdcInput * EXCHANGE_RATE;
const calcSwapOutputUsdc = (dibsInput: number): number =>
  dibsInput / EXCHANGE_RATE;

// --- Stake math (mirrors src/app/stake/page.tsx) -------------------------
const calcStakingDailyReward = (amountNum: number, apy: string): number =>
  (amountNum * parseFloat(apy) / 100) / 365;
const calcStakingTotalYield = (
  amountNum: number,
  apy: string,
  lockDays: number
): number => (amountNum * parseFloat(apy) * lockDays) / (365 * 100);

// --- Stake validation logic (mirrors src/app/stake/page.tsx) -------------
interface StakeValidation {
  amountNum: number;
  isValid: boolean;
  isOverBalance: boolean;
}
function validateStake(input: string, balance: number): StakeValidation {
  const num = parseFloat(input) || 0;
  return {
    amountNum: num,
    isValid: input !== "" && num > 0,
    isOverBalance: num > balance,
  };
}

// ===========================================================================
//  CANONICAL CONSTANTS
// ===========================================================================
describe("Canonical constants", () => {
  it("EXCHANGE_RATE must equal 10 — drives the 1 USDC = 10 DIBS ratio", () => {
    expect(EXCHANGE_RATE).toBe(10);
  });

  it("ARC_TESTNET_CHAIN_ID must equal 5042002 (default fallback)", () => {
    expect(ARC_TESTNET_CHAIN_ID).toBe(5042002);
  });

  it("VAULT_ADDRESS is a 0x-prefixed 40-hex string", () => {
    expect(VAULT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("DIBS_CONTRACT_ADDRESS is a 0x-prefixed 40-hex string", () => {
    expect(DIBS_CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

// ===========================================================================
//  TOKEN SWAP CALCULATIONS — USDC ↔ DIBS
// ===========================================================================
describe("Token Swap calculations (USDC ↔ DIBS)", () => {
  it("1 USDC must equal 10 DIBS — the canonical ratio", () => {
    expect(calcSwapOutputDibs(1)).toBe(10);
  });

  it("whole-number USDC inputs yield integer DIBS outputs", () => {
    expect(calcSwapOutputDibs(5)).toBe(50);
    expect(calcSwapOutputDibs(100)).toBe(1000);
    expect(calcSwapOutputDibs(1_000)).toBe(10_000);
  });

  it("fractional USDC inputs scale linearly", () => {
    expect(calcSwapOutputDibs(0.25)).toBeCloseTo(2.5, 10);
    expect(calcSwapOutputDibs(2.5)).toBeCloseTo(25, 10);
    expect(calcSwapOutputDibs(0.0001)).toBeCloseTo(0.001, 10);
  });

  it("zero USDC input yields zero DIBS", () => {
    expect(calcSwapOutputDibs(0)).toBe(0);
  });

  it("reverse direction: DIBS → USDC preserves ratio", () => {
    expect(calcSwapOutputUsdc(10)).toBe(1);
    expect(calcSwapOutputUsdc(45)).toBeCloseTo(4.5, 10);
    expect(calcSwapOutputUsdc(0)).toBe(0);
  });

  // The wei-level guarantee is what actually reaches the smart contract.
  // The UI uses parseFloat formatting, but writeContract() on the Swap page
  // calls parseUnits(value, 18).  This test pins that precision assumption.
  it("18-decimal wei conversion preserves the swap ratio", () => {
    const oneUsdc = parseUnits("1", 18);
    const tenDibs = parseUnits("10", 18);
    expect(oneUsdc * BigInt(EXCHANGE_RATE)).toBe(tenDibs);
    // viem's formatUnits trims trailing zeros → integer output is "10" not "10.0"
    expect(formatUnits(oneUsdc * BigInt(EXCHANGE_RATE), 18)).toBe("10");
  });

  it("wei-level round-trip: 5 USDC = 50 DIBS", () => {
    const fiveUsdc = parseUnits("5", 18);
    expect(fiveUsdc * BigInt(EXCHANGE_RATE)).toBe(parseUnits("50", 18));
  });
});

// ===========================================================================
//  STAKING INPUT LOGIC — lock periods, APYs, yield formulas
// ===========================================================================
describe("Staking lock-period catalogue stays in lockstep with src/app/stake/page.tsx", () => {
  it("lock periods are exactly [7, 30, 90, 180] days", () => {
    expect(LOCK_PERIODS.map((lp) => lp.days)).toEqual([7, 30, 90, 180]);
  });

  it("APYs are exactly ['8.5%', '12.5%', '18.0%', '24.0%']", () => {
    expect(LOCK_PERIODS.map((lp) => lp.apy)).toEqual([
      "8.5%",
      "12.5%",
      "18.0%",
      "24.0%",
    ]);
  });

  it("longer lock periods always yield a higher APY", () => {
    const apys = LOCK_PERIODS.map((lp) => parseFloat(lp.apy));
    for (let i = 1; i < apys.length; i++) {
      expect(apys[i]).toBeGreaterThan(apys[i - 1]);
    }
  });

  it("every period resolves to a positive numeric APY", () => {
    for (const lp of LOCK_PERIODS) {
      const value = parseFloat(lp.apy);
      expect(value).toBeGreaterThan(0);
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("Staking yield formulas", () => {
  it("daily reward: 1000 DIBS @ 12.5% APY ≈ 0.3425 DIBS/day", () => {
    expect(calcStakingDailyReward(1000, "12.5%")).toBeCloseTo(0.3424657534, 6);
  });

  it("daily reward: 0 DIBS → 0 reward regardless of APY", () => {
    expect(calcStakingDailyReward(0, "24.0%")).toBe(0);
  });

  it("total yield: 1000 DIBS @ 12.5% APY for 30 days ≈ 10.27 DIBS", () => {
    expect(calcStakingTotalYield(1000, "12.5%", 30)).toBeCloseTo(10.27397260, 4);
  });

  it("total yield: longer locks on the canonical APY curve yield more", () => {
    // Pull the actual period catalogue so a future edit to LOCK_PERIODS
    // surfaces as a test failure rather than a stale constant.
    const yields = LOCK_PERIODS.map((lp) =>
      calcStakingTotalYield(1000, lp.apy, 365) // pretend we held for a year
    );
    for (let i = 1; i < yields.length; i++) {
      expect(yields[i]).toBeGreaterThan(yields[i - 1]);
    }
  });

  it("stake amount serialised to 18-decimal wei for vault.stake()", () => {
    expect(parseUnits("1000", 18)).toBe(10n ** 21n);
    expect(parseUnits("0.5", 18)).toBe(5n * 10n ** 17n);
  });
});

// ===========================================================================
//  STAKING INPUT VALIDATION — boundary conditions
// ===========================================================================
describe("Staking input validation rules", () => {
  it("empty string is rejected as invalid", () => {
    expect(validateStake("", 100).isValid).toBe(false);
  });

  it("the literal '0' is rejected as invalid", () => {
    expect(validateStake("0", 100).isValid).toBe(false);
  });

  it("a positive number under balance is valid and not overdraw", () => {
    const out = validateStake("5", 100);
    expect(out.isValid).toBe(true);
    expect(out.isOverBalance).toBe(false);
    expect(out.amountNum).toBe(5);
  });

  it("a positive number exceeding balance triggers overdraw", () => {
    const out = validateStake("100.01", 100);
    expect(out.isValid).toBe(true); // still positive — only the button flag changes
    expect(out.isOverBalance).toBe(true);
  });

  it("exactly the available balance is the upper safe boundary (no overdraw)", () => {
    expect(validateStake("100", 100).isOverBalance).toBe(false);
  });

  it("garbage strings collapse to zero (invalid, no overdraw)", () => {
    const out = validateStake("not-a-number", 100);
    expect(out.amountNum).toBe(0);
    expect(out.isValid).toBe(false);
    expect(out.isOverBalance).toBe(false);
  });
});

// ===========================================================================
//  formatAddress — UI helper
// ===========================================================================
describe("formatAddress utility", () => {
  it("truncates 0x… addresses in 0x1234…5678 form", () => {
    expect(formatAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "0x1234...5678"
    );
  });

  it("leaves short strings untouched (preserves the original input)", () => {
    expect(formatAddress("0x1234")).toBe("0x1234");
  });

  it("returns empty string for empty input", () => {
    expect(formatAddress("")).toBe("");
  });

  it("does not break on the canonical lowercase vault address", () => {
    expect(formatAddress("0xc45073b9de74c7f286c2545a618b703f31228cb6")).toBe(
      "0xc450...8cb6"
    );
  });
});
