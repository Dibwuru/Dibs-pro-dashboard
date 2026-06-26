'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';

// Build-time safe fallbacks. During `next build`, Next.js statically pre-renders
// global layouts (e.g. `/_not-found`) without access to runtime env vars. Without
// these fallbacks, PrivyProvider throws "invalid Privy app ID" and viem's
// `defineChain` throws on `Number(undefined) => NaN`, breaking the entire build.
// Runtime values (Vercel, local dev) come from real env vars; build values are
// valid-format placeholders that are immediately replaced on the client.
const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cl00000000000000000000000';
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 5042002;
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || 'https://arc-testnet.drpc.org';
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://arc-testnet.drpc.org';

const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: EXPLORER_URL,
    },
  },
  testnet: true,
});

export { arcTestnet };

export default function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4AF37',
          showWalletLoginFirst: false,
        },
        supportedChains: [arcTestnet],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
