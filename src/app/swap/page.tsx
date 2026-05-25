"use client";

import { ArrowLeftRight, Info } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

export default function SwapPage() {
  const [payToken, setPayToken] = useState<"ETH" | "DIBS">("ETH");
  const [receiveToken, setReceiveToken] = useState<"ETH" | "DIBS">("DIBS");

  const handleSwapTokens = () => {
    setPayToken((prev) => (prev === "ETH" ? "DIBS" : "ETH"));
    setReceiveToken((prev) => (prev === "ETH" ? "DIBS" : "ETH"));
  };

  const exchangeRate =
    payToken === "ETH" && receiveToken === "DIBS"
      ? "1 ETH = 1,000 DIBS"
      : "1,000 DIBS = 1 ETH";

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Swap Tokens</h1>
          <p className="text-text-muted text-sm">
            Trade tokens instantly on the Arc Testnet
          </p>
        </div>

        {/* Swap Card */}
        <GlassCard className="space-y-4">
          {/* Pay */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              You Pay
            </label>
            <div className="relative flex items-center bg-navy/50 rounded-xl p-4 border border-white/[0.06]">
              <input
                type="number"
                placeholder="0.0"
                className="w-full bg-transparent text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted/50 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 text-sm font-semibold text-primary">
                {payToken}
              </span>
            </div>
          </div>

          {/* Switch */}
          <div className="flex justify-center">
            <button
              onClick={handleSwapTokens}
              className="p-2 rounded-xl bg-navy border border-white/[0.06] text-primary hover:bg-primary/10 hover:rotate-180 transition-all duration-300 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Receive */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              You Receive
            </label>
            <div className="relative flex items-center bg-navy/50 rounded-xl p-4 border border-white/[0.06]">
              <input
                type="number"
                placeholder="0.0"
                className="w-full bg-transparent text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted/50 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 text-sm font-semibold text-primary">
                {receiveToken}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy/30 border border-white/[0.04]">
            <Info className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted">
              {exchangeRate}
            </span>
          </div>

          {/* Action */}
          <Button size="lg" className="w-full" disabled>
            <ArrowLeftRight className="w-4 h-4" />
            Connect Wallet to Swap
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
