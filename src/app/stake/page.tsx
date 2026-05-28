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
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Earn rewards by staking your DIBS tokens
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <GlassCard className="p-4 text-center">
            <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">12.5%</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">APY</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <Lock className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">1.2M</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">TVL</p>
          </GlassCard>
        </div>

        {/* Stake Card */}
        <GlassCard className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
              Stake Amount
            </label>
            <div className="relative flex items-center bg-slate-100 dark:bg-[#121826] rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <input
                type="number"
                placeholder="0.0"
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-200 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-amber-600 dark:text-primary">
                DIBS
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Estimated Rewards</span>
              <span className="text-success font-medium">0.00 DIBS/day</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Lock Period</span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
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
