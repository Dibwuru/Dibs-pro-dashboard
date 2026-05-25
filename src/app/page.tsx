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
  ArrowDown,
  TrendingUp,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";

const ARC_TESTNET_CHAIN_ID = 5042002;

const transactions = [
  {
    type: "Contract Interaction (Stake)",
    date: "May 24, 2026",
    amount: "50,000.00 DIBS",
    status: "Confirmed" as const,
    hash: "0x1a2b...3c4d",
  },
  {
    type: "Transfer Sent",
    date: "May 23, 2026",
    amount: "12,500.00 DIBS",
    status: "Confirmed" as const,
    hash: "0x5e6f...7g8h",
  },
  {
    type: "Token Received",
    date: "May 22, 2026",
    amount: "25,000.00 DIBS",
    status: "Pending" as const,
    hash: "0x9i0j...1k2l",
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const [isMockConnected, setIsMockConnected] = useState(false);
  const [mockEmail, setMockEmail] = useState("");
  const isWrongNetwork =
    isConnected && chainId !== ARC_TESTNET_CHAIN_ID;

  const handleTurnkeyLogin = (email: string) => {
    // Simulated Turnkey embedded login — sets mock connection state to true
    console.log("Turnkey login initiated for:", email);
    setMockEmail(email);
    setIsMockConnected(true);
  };

  const isLoggedIn = isConnected || isMockConnected;

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

      {!isLoggedIn ? (
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
              <EmailLoginForm onLogin={handleTurnkeyLogin} />
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
        /* ===== CONNECTED: Dashboard ===== */
        <section className="relative flex-1 overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
            {/* ===== DASHBOARD VIEW ===== */}
            <div className="space-y-8">
                {/* Balance Hero Card */}
                <GlassCard className="p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.04] rounded-full blur-[80px] pointer-events-none" />
                  <div className="relative">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                          Portfolio Value
                        </p>
                        <div className="flex items-baseline gap-3 mt-1">
                          <h1
                            className="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight tabular-nums"
                            style={{
                              textShadow:
                                "0 0 40px rgba(124, 58, 237, 0.15)",
                            }}
                          >
                            145,230.50
                          </h1>
                          <span className="text-xl sm:text-2xl font-semibold text-text-secondary">
                            DIBS
                          </span>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-sm font-semibold text-text-primary">
                          $218,492.75
                        </p>
                        <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-success/10 border border-success/20">
                          <TrendingUp className="w-3 h-3 text-success" />
                          <span className="text-xs font-semibold text-success">
                            +1.5% (24h)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Shield className="w-3.5 h-3.5" />
                      <span>
                        {isMockConnected
                          ? mockEmail
                          : address
                            ? `${address.slice(0, 6)}...${address.slice(-4)}`
                            : "Connected"}
                      </span>
                    </div>
                  </div>
                </GlassCard>

                {/* Metric Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Staked */}
                  <div className="rounded-xl bg-navy-light/50 backdrop-blur-md border border-white/[0.10] p-6 hover:border-white/[0.16] transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Staked
                      </p>
                    </div>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      85,000.00
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">DIBS</p>
                  </div>

                  {/* Earned */}
                  <div className="rounded-xl bg-navy-light/50 backdrop-blur-md border border-white/[0.10] p-6 hover:border-white/[0.16] transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/20 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-secondary" />
                      </div>
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Earned
                      </p>
                    </div>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      1,200.00
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">DIBS</p>
                  </div>

                  {/* Rewards */}
                  <div className="rounded-xl bg-navy-light/50 backdrop-blur-md border border-white/[0.10] p-6 hover:border-white/[0.16] transition-all duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-accent" />
                      </div>
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Rewards
                      </p>
                    </div>
                    <p className="text-xl font-bold text-text-primary tabular-nums">
                      14,500.00
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">DIBS</p>
                  </div>
                </div>

                {/* Recent Activity */}
                <GlassCard className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Recent Activity
                    </h3>
                    <button className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                      View All
                    </button>
                  </div>
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left py-3 px-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                            Transaction
                          </th>
                          <th className="text-left py-3 px-2 text-xs font-medium text-text-muted uppercase tracking-wider hidden sm:table-cell">
                            Date
                          </th>
                          <th className="text-right py-3 px-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="text-right py-3 px-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, i) => (
                          <tr
                            key={i}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                                  {tx.type.includes("Stake") ? (
                                    <Coins className="w-3.5 h-3.5 text-primary" />
                                  ) : tx.type.includes("Sent") ? (
                                    <ArrowRight className="w-3.5 h-3.5 text-warning -rotate-45" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-success" />
                                  )}
                                </div>
                                <span className="text-xs font-medium text-text-primary truncate max-w-[140px]">
                                  {tx.type}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-2 hidden sm:table-cell">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-text-muted" />
                                <span className="text-xs text-text-secondary">
                                  {tx.date}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              <span className="text-xs font-mono font-medium text-text-primary">
                                {tx.amount}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  tx.status === "Confirmed"
                                    ? "bg-success/10 text-success border border-success/20"
                                    : "bg-warning/10 text-warning border border-warning/20"
                                }`}
                              >
                                {tx.status === "Confirmed" ? (
                                  <CheckCircle className="w-2.5 h-2.5" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5" />
                                )}
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Disconnect */}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (isMockConnected) {
                        setIsMockConnected(false);
                        setMockEmail("");
                      } else {
                        disconnect();
                      }
                    }}
                    className="text-xs font-medium text-text-muted hover:text-error transition-colors px-3 py-1.5 rounded-lg hover:bg-error/5"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </div>

          </div>
        </section>
      )}
    </div>
  );
}

/** Reusable email input for Turnkey embedded login visual setup */
function EmailLoginForm({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (error) setError("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) {
          setError("Please enter your email address.");
          return;
        }
        if (!isValidEmail(trimmed)) {
          setError("Please enter a valid email address.");
          return;
        }
        onLogin(trimmed);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
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
      </div>
      {error && (
        <p className="text-xs text-error/80 pl-1">{error}</p>
      )}
    </form>
  );
}
