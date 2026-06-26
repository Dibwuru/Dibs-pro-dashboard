"use client";

import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

// Build-time safe fallbacks so `next build` doesn't crash on
// `Number(undefined) => NaN` or undefined URLs when statically pre-rendering
// global layouts. Real values are injected at runtime by Vercel/local env.
// `Number(undefined) || 1337` correctly evaluates to `1337` because NaN is falsy.
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1337;
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.local";

export const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: EXPLORER_URL,
    },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
