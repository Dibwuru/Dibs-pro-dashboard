"use client";

import { Coins, TrendingUp, Clock, Lock } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

export default function StakePage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">
            Stake DIBS
          </h1>
          <p className="text-text-muted text-sm">
            Earn rewards by staking your DIBS tokens
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <GlassCard className="p-4 text-center">
            <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-text-primary">12.5%</p>
            <p className="text-xs text-text-muted">APY</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <Lock className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-text-primary">1.2M</p>
            <p className="text-xs text-text-muted">TVL</p>
          </GlassCard>
        </div>

        {/* Stake Card */}
        <GlassCard className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              Stake Amount
            </label>
            <div className="flex items-center gap-3 bg-navy/50 rounded-xl p-4 border border-white/[0.06]">
              <input
                type="number"
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted/50"
              />
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm font-semibold text-primary hover:bg-primary/15 transition-all">
                DIBS
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Estimated Rewards</span>
              <span className="text-success font-medium">0.00 DIBS/day</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Lock Period</span>
              <span className="flex items-center gap-1 text-text-secondary">
                <Clock className="w-3.5 h-3.5" />7 days
              </span>
            </div>
          </div>

          <Button size="lg" className="w-full" disabled>
            <Coins className="w-4 h-4" />
            Connect Wallet to Stake
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
