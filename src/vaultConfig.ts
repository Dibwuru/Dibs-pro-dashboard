import { type Abi } from "viem";

export const VAULT_ADDRESS = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7";
export const DIBS_CONTRACT_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
export const EXCHANGE_RATE = 10; // 1 Native Token = 10 DIBS
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_EXPLORER_URL = "https://testnet.explorer.arc.network";

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
    ],
  },
  {
    type: "event",
    name: "TokensUnstaked",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
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
