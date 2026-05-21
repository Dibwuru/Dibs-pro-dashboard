import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  Send,
  Coins,
  Zap,
  Wallet,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-8">
          <Zap className="w-3.5 h-3.5" />
          Now Live on Arc Testnet
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
          <span className="text-text-primary">Trade Faster with </span>
          <span className="text-gradient">DibsCoin</span>
        </h1>

        <p className="mt-6 text-lg text-text-muted max-w-xl leading-relaxed">
          The next-generation decentralized exchange. Swap tokens, send
          payments, and earn yield through staking — all powered by the Arc
          Testnet.
        </p>

        {/* CTA Button */}
        <div className="mt-10">
          <Link href="/swap">
            <Button size="lg" icon={<ArrowRight className="w-4 h-4" />}>
              Start Using DibsCoin
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
              Powerful DeFi Tools
            </h2>
            <p className="text-text-muted max-w-md mx-auto">
              Everything you need to manage your digital assets on the Arc
              Network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <GlassCard hover className="text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Swap
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Instantly swap between any supported tokens with minimal
                slippage and low fees, all on-chain on Arc Testnet.
              </p>
            </GlassCard>

            <GlassCard hover className="text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-4">
                <Send className="w-5 h-5 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Send
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Send tokens to any wallet instantly and securely. Fast
                transactions with near-zero fees on the Arc Network.
              </p>
            </GlassCard>

            <GlassCard hover className="text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center mb-4">
                <Coins className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Stake
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Stake your DIBS tokens to earn competitive yields. Flexible
                lock periods with auto-compounding rewards.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Connect Wallet CTA */}
      <section className="px-4 pb-24">
        <GlassCard className="max-w-3xl mx-auto text-center p-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
            Get started in seconds. Connect your wallet, grab testnet ETH from
            the faucet, and unlock the full power of DibsCoin on Arc Testnet.
          </p>
          <Link href="/swap">
            <Button
              size="lg"
              icon={<Wallet className="w-4 h-4" />}
            >
              Connect Wallet
            </Button>
          </Link>
        </GlassCard>
      </section>
    </div>
  );
}
