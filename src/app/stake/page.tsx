"use client";

import { Coins, TrendingUp, Clock, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

const DIBS_CONTRACT_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
const ARC_TESTNET_CHAIN_ID = 5042002;

const dibsBalanceOfABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export default function StakePage() {
  const { authenticated, user, login } = usePrivy();
  const { wallets: stakeWallets } = useWallets();

  const isWalletConnected = authenticated && !!user?.wallet?.address;

  const activeStakeWallet = stakeWallets[0];
  const activeStakeChainId = activeStakeWallet
    ? Number(activeStakeWallet.chainId.replace("eip155:", ""))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeStakeChainId !== null &&
    activeStakeChainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = user?.wallet?.address as `0x${string}` | undefined;

  // --- Fetch DIBS balance ---
  const [dibsBalanceRaw, setDibsBalanceRaw] = useState<bigint | null>(null);
  const [dibsBalanceLoading, setDibsBalanceLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setDibsBalanceRaw(null);
      setDibsBalanceLoading(false);
      return;
    }
    let cancelled = false;
    const fetchDibs = async () => {
      if (dibsBalanceRaw === null) {
        setDibsBalanceLoading(true);
      }
      try {
        const bal = await publicClient.readContract({
          address: DIBS_CONTRACT_ADDRESS,
          abi: dibsBalanceOfABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        if (!cancelled) {
          setDibsBalanceRaw(bal);
          setDibsBalanceLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDibsBalanceRaw(null);
          setDibsBalanceLoading(false);
        }
      }
    };
    fetchDibs();
    const interval = setInterval(fetchDibs, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  const dibsBalanceNum = dibsBalanceRaw != null
    ? parseFloat(formatUnits(dibsBalanceRaw, 18))
    : 0;
  const dibsBalanceDisplay = dibsBalanceRaw != null
    ? Number(formatUnits(dibsBalanceRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0";

  // --- Stake State ---
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakedBalance, setStakedBalance] = useState(0);
  const [isStaking, setIsStaking] = useState(false);

  // --- 50% / MAX shortcuts ---
  const handleFiftyPercent = useCallback(() => {
    setStakeAmount((dibsBalanceNum * 0.5).toString());
  }, [dibsBalanceNum]);

  const handleMax = useCallback(() => {
    setStakeAmount(dibsBalanceNum.toString());
  }, [dibsBalanceNum]);

  const isValidStake = stakeAmount !== "" && parseFloat(stakeAmount) > 0;

  // --- Execute Stake ---
  const handleStake = useCallback(async () => {
    if (!isValidStake) return;

    setIsStaking(true);
    try {
      // Simulate on-chain staking delay for UX feedback
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const parsed = parseFloat(stakeAmount);
      setStakedBalance((prev) => prev + parsed);
      toast.success("Assets successfully committed to the Sovereign Staking Vault!");
      setStakeAmount("");
    } catch {
      toast.error("Staking failed. Please try again.");
    } finally {
      setIsStaking(false);
    }
  }, [stakeAmount, isValidStake]);

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

        {/* Wrong Network Warning */}
        {isWrongNetwork && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              Switch to Arc Testnet (Chain ID: {ARC_TESTNET_CHAIN_ID})
            </p>
          </div>
        )}

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
          {/* Available Balance */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Available Balance
            </span>
            <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
              {dibsBalanceLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </span>
              ) : isWalletConnected ? (
                `${dibsBalanceDisplay} DIBS`
              ) : (
                "—"
              )}
            </span>
          </div>

          {/* Staked Balance (if any) */}
          {stakedBalance > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/5 border border-success/10 text-xs text-success">
              <Lock className="w-3.5 h-3.5" />
              <span>Staked: {stakedBalance.toLocaleString()} DIBS</span>
            </div>
          )}

          {/* Stake Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Stake Amount
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleFiftyPercent}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all cursor-pointer select-none"
                >
                  50%
                </button>
                <button
                  onClick={handleMax}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all cursor-pointer select-none"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="input-box relative flex items-center p-4">
              <input
                type="number"
                placeholder="0.0"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
              />
              <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold select-none">
                DIBS
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Estimated Rewards</span>
              <span className="text-success font-medium">
                {isValidStake
                  ? `${((parseFloat(stakeAmount) * 0.125) / 365).toFixed(4)} DIBS/day`
                  : "0.00 DIBS/day"}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Lock Period</span>
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5" />7 days
              </span>
            </div>
          </div>

          {/* Action Button */}
          {isWalletConnected ? (
            <Button
              size="lg"
              className="w-full"
              disabled={!isValidStake || isStaking || isWrongNetwork}
              loading={isStaking}
              onClick={handleStake}
              icon={!isStaking ? <Lock className="w-4 h-4" /> : undefined}
            >
              {isStaking ? "Staking..." : "Confirm Stake"}
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => login()}
              icon={<Coins className="w-4 h-4" />}
            >
              Connect Wallet to Stake
            </Button>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
