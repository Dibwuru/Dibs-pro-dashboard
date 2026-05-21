"use client";

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1 px-4 py-24">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Dashboard</h1>
          <p className="text-text-muted text-sm">
            Your portfolio overview and activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Balance
              </span>
            </div>
            <p className="text-2xl font-bold text-text-primary">$0.00</p>
            <p className="text-xs text-text-muted mt-1">0 DIBS / 0 ETH</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Staked
              </span>
            </div>
            <p className="text-2xl font-bold text-text-primary">0 DIBS</p>
            <p className="text-xs text-text-muted mt-1">0.00 DIBS earned</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Sent
              </span>
            </div>
            <p className="text-2xl font-bold text-text-primary">0</p>
            <p className="text-xs text-text-muted mt-1">Total transactions</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="w-4 h-4 text-secondary" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Received
              </span>
            </div>
            <p className="text-2xl font-bold text-text-primary">0</p>
            <p className="text-xs text-text-muted mt-1">Total transactions</p>
          </GlassCard>
        </div>

        {/* Recent Activity */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Recent Activity
            </h2>
          </div>
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
            <p className="text-text-muted text-sm">
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
