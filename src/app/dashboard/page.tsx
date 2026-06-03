"use client";

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1 py-24">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Your portfolio overview and activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Balance
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">$0.00</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">0 DIBS / 0 ETH</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Staked
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">0 DIBS</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">0.00 DIBS earned</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Sent
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">0</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Total transactions</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="w-4 h-4 text-secondary" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Received
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">0</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Total transactions</p>
          </GlassCard>
        </div>

        {/* Recent Activity */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              Recent Activity
            </h2>
          </div>
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-300/30 dark:text-slate-500/30 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Connect your wallet to see activity
            </p>
            <Button variant="secondary" size="sm" className="mt-4" disabled>
              Connect Wallet
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
