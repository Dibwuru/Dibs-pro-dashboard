'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';

const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID!),
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL!],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL!,
    },
  },
  testnet: true,
});

export { arcTestnet };

export default function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
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
