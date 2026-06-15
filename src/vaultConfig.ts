import { type Abi } from "viem";

export const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS! as `0x${string}`;
export const DIBS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DIBS_ADDRESS! as `0x${string}`;
export const EXCHANGE_RATE = 10; // 1 Native Token = 10 DIBS
export const ARC_TESTNET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID!);
export const ARC_EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL!;

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
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL!],
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
