import { type Abi } from "viem";

// --- Arc Testnet token & vault addresses -----------------------------------
//
// Hardcoded canonical fallbacks for the Dibs ERC-20 token and the V3 swap/stake
// vault on Arc Testnet (chain ID 5042002). These fallbacks are used whenever
// NEXT_PUBLIC_DIBS_ADDRESS / NEXT_PUBLIC_VAULT_ADDRESS are missing or malformed
// (e.g. when an environment variable was edited and lost a character). Keeping
// the fallbacks in lockstep with the live deployment ensures balance reads
// (balanceOf) and approval targets (approve) always point at the SAME contract.
//
// Source of truth (matches scripts/swap_vault_meta.txt,
// scripts/probe-selectors.ts, scripts/check-balances.ts).
const FALLBACK_VAULT_ADDRESS =
  "0xc45073b9de74c7f286c2545a618b703f31228cb6" as `0x${string}`;
const FALLBACK_DIBS_ADDRESS =
  "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912" as `0x${string}`;

/**
 * Validates that a string is a proper 0x-prefixed 40-hex-character Ethereum
 * address. Returns true only when the input matches /^0x[a-fA-F0-9]{40}$/.
 *
 * This guards against the recurring bug where an env var is set to a
 * 39-hex-character address (missing one digit) causing every balanceOf /
 * approve call to silently revert on-chain.
 */
function assertValidAddress(
  value: string | undefined,
  fallback: `0x${string}`
): `0x${string}` {
  if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
    return value as `0x${string}`;
  }
  if (typeof value === "string" && value.length > 0) {
    // Don't crash the build — log a clear, actionable warning and fall through
    // to the canonical address so the dApp remains usable in production.
    // eslint-disable-next-line no-console
    console.warn(
      `[vaultConfig] Invalid address in env var (length=${value.length}, value="${value}"). ` +
        `Falling back to canonical address ${fallback}. ` +
        `Re-check NEXT_PUBLIC_VAULT_ADDRESS / NEXT_PUBLIC_DIBS_ADDRESS.`
    );
  }
  return fallback;
}

export const VAULT_ADDRESS = assertValidAddress(
  process.env.NEXT_PUBLIC_VAULT_ADDRESS,
  FALLBACK_VAULT_ADDRESS
);
export const DIBS_CONTRACT_ADDRESS = assertValidAddress(
  process.env.NEXT_PUBLIC_DIBS_ADDRESS,
  FALLBACK_DIBS_ADDRESS
);

export const EXCHANGE_RATE = 10; // 1 Native Token = 10 DIBS
// Harmonize with Web3Provider/PrivyAuthProvider fallbacks so chain ID guards
// never evaluate against NaN when env vars are missing — guarantees the
// global banner check resolves to the canonical Arc Testnet (5042002).
export const ARC_TESTNET_CHAIN_ID =
  Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 5042002;
export const ARC_EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://arc-testnet.drpc.org";
export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://arc-testnet.drpc.org";

/**
 * Robustly switch the user's wallet to Arc Testnet.
 * Works for both embedded wallets (Privy) and external wallets (MetaMask, etc.).
 * Handles the case where the chain hasn't been added to the wallet yet (EIP-4902).
 */
export async function switchToArcTestnet(wallet: {
  switchChain: (chainId: number) => Promise<void>;
  getEthereumProvider: () => Promise<any>;
  chainId: string;
}) {
  const currentChainId = Number(wallet.chainId.replace("eip155:", ""));
  if (currentChainId === ARC_TESTNET_CHAIN_ID) return;

  try {
    // Attempt direct switch (works for Privy embedded wallets and most external wallets)
    await wallet.switchChain(ARC_TESTNET_CHAIN_ID);
  } catch (switchError: any) {
    // EIP-4902: chain not added to wallet — add it first then retry
    if (
      switchError?.code === 4902 ||
      switchError?.cause?.code === 4902 ||
      String(switchError?.message || "").includes("Unrecognized chain")
    ) {
      const provider = await wallet.getEthereumProvider();
      await provider.request({
        method: "wallet_addEthereumChain",          params: [
          {
            chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC_RPC_URL],
            blockExplorerUrls: [ARC_EXPLORER_URL],
          },
        ],
      });
      // Retry switch after adding
      await wallet.switchChain(ARC_TESTNET_CHAIN_ID);
    } else {
      throw switchError;
    }
  }
}

export const vaultABI = [
  {
    type: "function",
    name: "swapUsdcForDibs",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "swapDibsForUsdc",
    stateMutability: "nonpayable",
    inputs: [{ name: "dibsAmount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "lockDays", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "stakeIndex", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getUserStakesCount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "userStakes",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "releaseTime", type: "uint256" },
      { name: "apyRate", type: "uint256" },
      { name: "lockDays", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "exchangeRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AssetSwapped",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "direction", type: "string", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensStaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "releaseTime", type: "uint256", indexed: false },
      { name: "apyRate", type: "uint256", indexed: false },
      { name: "lockDays", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensUnstaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

export const dibsBalanceOfABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const erc20ApproveABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;
