"use client";

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import {
  Shield,
  Wallet,
  Mail,
  ArrowRight,
  AlertTriangle,
  Zap,
  Coins,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";

const ARC_TESTNET_CHAIN_ID = 490413;

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const isWrongNetwork =
    isConnected && chainId !== ARC_TESTNET_CHAIN_ID;

  return (
    <div className="flex flex-col flex-1">
      {/* Wrong Network Warning Banner */}
      {isWrongNetwork && (
        <div className="sticky top-16 z-40 flex items-center justify-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-200/90">
            You are connected to an unsupported network. Please switch to Arc
            Testnet (Chain ID: {ARC_TESTNET_CHAIN_ID}) in your wallet.
          </p>
        </div>
      )}

      {!isConnected ? (
        /* ===== NOT CONNECTED: Login Interface ===== */
        <section className="flex flex-col items-center justify-center flex-1 px-4 py-16">
          <div className="w-full max-w-md space-y-6">
            {/* Header */}
            <div className="text-center space-y-3 mb-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
                <Zap className="w-3.5 h-3.5" />
                Pre-Alpha Access
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
                Welcome to{" "}
                <span className="text-gradient">DibsCoin</span>
              </h1>
              <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">
                Connect your wallet or sign in with email to start trading on
                the Arc Testnet.
              </p>
            </div>

            {/* Turnkey Email Login */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Email Sign-In
                  </h3>
                  <p className="text-xs text-text-muted">
                    Powered by Turnkey — no seed phrase needed
                  </p>
                </div>
              </div>
              <EmailLoginForm />
            </GlassCard>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                or connect wallet
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Wagmi Connectors */}
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl glass-sm hover:bg-white/[0.06] hover:border-white/12 transition-all duration-200 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF9A4D] to-[#E27625] flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-semibold text-text-primary">
                      {connector.name}
                    </span>
                    <p className="text-xs text-text-muted">
                      Browser wallet
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        /* ===== CONNECTED: Pre-Alpha Dashboard ===== */
        <section className="flex flex-col items-center justify-center flex-1 px-4 py-16">
          <div className="w-full max-w-lg space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                <Zap className="w-3 h-3" />
                Pre-Alpha v0.1.0
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
                Your Dashboard
              </h1>
              <p className="text-sm text-text-muted">
                Welcome back — your assets on Arc Testnet
              </p>
            </div>

            {/* Main Balance Card */}
            <GlassCard className="p-8 text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-medium text-success">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                Network Connected
              </div>

              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
                  DIBS Balance
                </p>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-4xl sm:text-5xl font-bold text-text-primary tabular-nums">
                    0.00
                  </span>
                  <span className="text-lg font-semibold text-text-secondary">
                    DIBS
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                <Shield className="w-3.5 h-3.5" />
                <span>
                  {address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : "Connected"}
                </span>
              </div>
            </GlassCard>

            {/* Gas & Utility Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* USDC Gas Box */}
              <GlassCard className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-secondary/20 border border-secondary/20 flex items-center justify-center">
                    <Coins className="w-3.5 h-3.5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      USDC
                    </p>
                    <p className="text-[10px] text-text-muted">Gas Asset</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-text-primary tabular-nums">
                  0.00
                </p>
              </GlassCard>

              {/* Disconnect */}
              <GlassCard className="p-4 flex flex-col items-center justify-center gap-1.5">
                <p className="text-xs font-medium text-text-muted">
                  Connected to Arc Testnet
                </p>
                <button
                  onClick={() => disconnect()}
                  className="text-xs font-medium text-error/80 hover:text-error transition-colors"
                >
                  Disconnect
                </button>
              </GlassCard>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Reusable email input for Turnkey embedded login visual setup */
function EmailLoginForm() {
  const [email, setEmail] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Turnkey embedded login integration point
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>
      <Button
        size="sm"
        icon={<ArrowRight className="w-3.5 h-3.5" />}
        className="flex-shrink-0"
        type="submit"
      >
        Sign In
      </Button>
    </form>
  );
}
