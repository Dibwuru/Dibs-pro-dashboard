"use client";

import { Coins, TrendingUp, Clock, Lock, AlertTriangle, Loader2, X, Unlock, ArrowDown } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits, parseUnits, createWalletClient, custom } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import {
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  ARC_EXPLORER_URL,
  vaultABI,
  dibsBalanceOfABI,
  erc20ApproveABI,
} from "@/vaultConfig";

const fallbackPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const LOCK_PERIODS = [
  { days: 7, label: "7 Days", apy: "8.5%" },
  { days: 30, label: "30 Days", apy: "12.5%" },
  { days: 90, label: "90 Days", apy: "18.0%" },
  { days: 180, label: "180 Days", apy: "24.0%" },
] as const;

type UserStake = {
  index: number;
  amount: bigint;
  releaseTime: bigint;
  apyRate: bigint;
  lockDays: bigint;
  claimed: boolean;
};

function formatCountdown(releaseTime: bigint): string {
  const remaining = Number(releaseTime) - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return "✅ Ready to Claim";
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  if (days > 0) return `⏳ Unlocks in ${days}d ${hours}h`;
  const mins = Math.floor((remaining % 3600) / 60);
  return `⏳ Unlocks in ${hours}h ${mins}m`;
}

function formatReleaseDate(releaseTime: bigint): string {
  return new Date(Number(releaseTime) * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StakePage() {
  const { authenticated, user, login } = usePrivy();
  const { wallets: stakeWallets } = useWallets();

  const isWalletConnected = (authenticated && !!user?.wallet?.address) || stakeWallets.length > 0;

  const activeStakeWallet = stakeWallets[0];
  const activeStakeChainId = activeStakeWallet
    ? Number(activeStakeWallet.chainId.replace("eip155:", ""))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeStakeChainId !== null &&
    activeStakeChainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = (stakeWallets[0]?.address as `0x${string}` | undefined);

  // Dynamic provider state so balance reads & writes route through the active wallet
  const [stakeWalletProvider, setStakeWalletProvider] = useState<any>(null);

  useEffect(() => {
    const wallet = stakeWallets[0];
    if (!wallet) {
      setStakeWalletProvider(null);
      return;
    }
    let cancelled = false;
    wallet.getEthereumProvider().then((p: any) => {
      if (!cancelled) setStakeWalletProvider(p);
    }).catch(() => {
      if (!cancelled) setStakeWalletProvider(null);
    });
    return () => { cancelled = true; };
  }, [stakeWallets]);

  const getPublicClient = useCallback(() => {
    if (stakeWalletProvider) {
      return createPublicClient({ chain: arcTestnet, transport: custom(stakeWalletProvider) });
    }
    return fallbackPublicClient;
  }, [stakeWalletProvider]);

  // --- Tab state: stake or unstake ---
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

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
        const client = getPublicClient();
        const bal = await client.readContract({
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
  const [isStaking, setIsStaking] = useState(false);
  const [lockPeriodDays, setLockPeriodDays] = useState<number>(7);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Live countdown tracker for time-based badges
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const selectedLockPeriod = LOCK_PERIODS.find((lp) => lp.days === lockPeriodDays) ?? LOCK_PERIODS[0];

  // --- 50% / MAX shortcuts ---
  const handleFiftyPercent = useCallback(() => {
    setStakeAmount((dibsBalanceNum * 0.5).toString());
  }, [dibsBalanceNum]);

  const handleMax = useCallback(() => {
    setStakeAmount(dibsBalanceNum.toString());
  }, [dibsBalanceNum]);

  const stakeAmountNum = parseFloat(stakeAmount) || 0;
  const isValidStake = stakeAmount !== "" && stakeAmountNum > 0;
  const isOverBalance = stakeAmountNum > dibsBalanceNum;
  const canStake = isValidStake && !isOverBalance;

  // --- Execute Stake (via vault.stake) ---
  const executeStake = useCallback(async () => {
    if (!canStake || stakeWallets.length === 0) return;

    // Balance check toast before proceeding
    if (isOverBalance) {
      toast.error("Insufficient DIBS balance for this action.");
      return;
    }

    setIsStaking(true);
    setShowConfirmModal(false);

    try {
      const activeWallet = stakeWallets[0];

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      const amountWei = parseUnits(stakeAmount, 18);

      await toast.promise(
        (async () => {
          // Step 1: Approve vault to spend DIBS (required for transferFrom in stake())
          const approveHash = await walletClient.writeContract({
            address: DIBS_CONTRACT_ADDRESS,
            abi: erc20ApproveABI,
            functionName: "approve",
            args: [VAULT_ADDRESS, amountWei],
          });
          const client = getPublicClient();
          const approveReceipt = await client.waitForTransactionReceipt({ hash: approveHash });
          if (approveReceipt.status !== "success") {
            throw new Error("Transaction Failed/Reverted — Approval step failed");
          }

          // Step 2: Call vault.stake(amount, lockDays)
          const stakeHash = await walletClient.writeContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "stake",
            args: [amountWei, BigInt(lockPeriodDays)],
          });

          const receipt = await client.waitForTransactionReceipt({ hash: stakeHash });
          if (receipt.status !== "success") {
            throw new Error("Transaction Failed/Reverted");
          }

          // Refresh DIBS balance and user stakes
          if (userAddress) {
            try {
              const client = getPublicClient();
              const newDibs = await client.readContract({
                address: DIBS_CONTRACT_ADDRESS,
                abi: dibsBalanceOfABI,
                functionName: "balanceOf",
                args: [userAddress],
              });
              setDibsBalanceRaw(newDibs);
            } catch { /* polling will catch up */ }
            // Trigger stakes refetch
            setStakesCacheBuster((v) => v + 1);
          }

          // Show explorer link as follow-up toast
          toast.success(
            `${stakeAmountNum.toLocaleString()} DIBS locked for ${lockPeriodDays} days`,
            {
              action: {
                label: "Explorer",
                onClick: () => window.open(`${ARC_EXPLORER_URL}/tx/${stakeHash}`, "_blank"),
              },
            }
          );

          return stakeHash;
        })(),
        {
          loading: `Staking DIBS for ${lockPeriodDays} days...`,
          success: "Stake confirmed!",
          error: (err) => {
            const e = err as Error & { code?: number; cause?: { code?: number } };
            if (e?.code === 4001 || e?.cause?.code === 4001 || String(e?.message || "").includes("User rejected")) {
              return "Transaction canceled by user";
            }
            const msg = e.message || "";
            return msg.includes("Transaction Failed/Reverted")
              ? "Transaction Failed/Reverted"
              : `Staking failed: ${msg.slice(0, 80)}`;
          },
        }
      );

      setStakeAmount("");
    } catch {
      // toast already handled
    } finally {
      setIsStaking(false);
    }
  }, [canStake, stakeWallets, stakeAmount, lockPeriodDays, userAddress, stakeAmountNum]);

  // --- Unstake State ---
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [stakesLoading, setStakesLoading] = useState(false);
  const [stakesCacheBuster, setStakesCacheBuster] = useState(0);
  const [unstakingIndex, setUnstakingIndex] = useState<number | null>(null);

  // Fetch user stakes from the vault
  useEffect(() => {
    if (!userAddress) {
      setUserStakes([]);
      return;
    }
    let cancelled = false;
    const fetchStakes = async () => {
      setStakesLoading(true);
      try {
        const client = getPublicClient();
        const count = await client.readContract({
          address: VAULT_ADDRESS,
          abi: vaultABI,
          functionName: "getUserStakesCount",
          args: [userAddress],
        }) as bigint;

        const stakes: UserStake[] = [];
        for (let i = 0; i < Number(count); i++) {
          const client = getPublicClient();
          const raw = await client.readContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "userStakes",
            args: [userAddress, BigInt(i)],
          }) as [bigint, bigint, bigint, bigint, boolean];

          stakes.push({
            index: i,
            amount: raw[0],
            releaseTime: raw[1],
            apyRate: raw[2],
            lockDays: raw[3],
            claimed: raw[4],
          });
        }
        if (!cancelled) {
          setUserStakes(stakes);
        }
      } catch {
        if (!cancelled) setUserStakes([]);
      } finally {
        if (!cancelled) setStakesLoading(false);
      }
    };
    fetchStakes();
    const interval = setInterval(fetchStakes, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress, stakesCacheBuster]);

  // --- Execute Unstake ---
  const executeUnstake = useCallback(async (stakeIndex: number) => {
    if (stakeWallets.length === 0) return;

    setUnstakingIndex(stakeIndex);
    try {
      const activeWallet = stakeWallets[0];

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      await toast.promise(
        (async () => {
          const unstakeHash = await walletClient.writeContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "unstake",
            args: [BigInt(stakeIndex)],
          });

          const client = getPublicClient();
          const receipt = await client.waitForTransactionReceipt({ hash: unstakeHash });
          if (receipt.status !== "success") {
            throw new Error("Transaction Failed/Reverted");
          }

          // Refresh balances and stakes
          if (userAddress) {
            try {
              const client = getPublicClient();
              const newDibs = await client.readContract({
                address: DIBS_CONTRACT_ADDRESS,
                abi: dibsBalanceOfABI,
                functionName: "balanceOf",
                args: [userAddress],
              });
              setDibsBalanceRaw(newDibs);
            } catch { /* polling will catch up */ }
            setStakesCacheBuster((v) => v + 1);
          }

          if (unstakeHash) {
            toast.success("Tokens unstaked successfully!", {
              action: {
                label: "Explorer",
                onClick: () => window.open(`${ARC_EXPLORER_URL}/tx/${unstakeHash}`, "_blank"),
              },
            });
          }

          return unstakeHash;
        })(),
        {
          loading: "Unstaking DIBS...",
          success: "Unstake confirmed!",
          error: (err) => {
            const e = err as Error & { code?: number; cause?: { code?: number } };
            if (e?.code === 4001 || e?.cause?.code === 4001 || String(e?.message || "").includes("User rejected")) {
              return "Transaction canceled by user";
            }
            const msg = e.message || "";
            return msg.includes("Transaction Failed/Reverted")
              ? "Transaction Failed/Reverted"
              : `Unstake failed: ${msg.slice(0, 80)}`;
          },
        }
      );
    } catch {
      // toast already handled
    } finally {
      setUnstakingIndex(null);
    }
  }, [stakeWallets, userAddress]);

  const totalStaked = userStakes
    .filter((s) => !s.claimed)
    .reduce((sum, s) => sum + Number(formatUnits(s.amount, 18)), 0);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showConfirmModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showConfirmModal]);

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
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">{selectedLockPeriod.apy}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">APY</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <Lock className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">
              {totalStaked > 0 ? totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Staked</p>
          </GlassCard>
        </div>

        {/* Tab Switcher: Stake / Unstake */}
        <div className="flex mb-4 rounded-xl bg-slate-100 dark:bg-[#121826]/60 p-1 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("stake")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
              activeTab === "stake"
                ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Lock className="w-3.5 h-3.5 inline mr-1.5" />
            Stake
          </button>
          <button
            onClick={() => setActiveTab("unstake")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
              activeTab === "unstake"
                ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Unlock className="w-3.5 h-3.5 inline mr-1.5" />
            Unstake
          </button>
        </div>

        {/* ===== STAKE TAB ===== */}
        {activeTab === "stake" && (
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

            {/* Total Staked summary */}
            {totalStaked > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/5 border border-success/10 text-xs text-success">
                <Lock className="w-3.5 h-3.5" />
                <span>Staked: {totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS</span>
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

            {/* Balance error */}
            {isOverBalance && (
              <p className="text-xs font-semibold text-error px-1">
                Insufficient $DIBS balance.
              </p>
            )}

            {/* Lock Period Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                Lock Period
              </label>
              <div className="grid grid-cols-4 gap-2">
                {LOCK_PERIODS.map((period) => (
                  <button
                    key={period.days}
                    type="button"
                    onClick={() => setLockPeriodDays(period.days)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer select-none border ${
                      lockPeriodDays === period.days
                        ? "bg-primary/15 border-primary/40 text-primary shadow-sm shadow-primary/10"
                        : "bg-slate-100 dark:bg-[#121826]/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary/20 hover:text-primary"
                    }`}
                  >
                    <div>{period.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{period.apy}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Estimated Rewards</span>
                <span className="text-success font-medium">
                  {isValidStake
                    ? `${((stakeAmountNum * parseFloat(selectedLockPeriod.apy) / 100) / 365).toFixed(4)} DIBS/day`
                    : "0.00 DIBS/day"}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Lock Period</span>
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5" />{selectedLockPeriod.label}
                </span>
              </div>
            </div>

            {/* Action Button */}
            {isWalletConnected ? (
              <Button
                size="lg"
                className="w-full"
                disabled={!canStake || isStaking || isWrongNetwork}
                loading={isStaking}
                onClick={() => setShowConfirmModal(true)}
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
        )}

        {/* ===== UNSTAKE TAB ===== */}
        {activeTab === "unstake" && (
          <GlassCard className="space-y-4">
            {!isWalletConnected ? (
              <div className="text-center py-8">
                <Unlock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Connect your wallet to view and manage your stakes
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => login()}
                  icon={<Coins className="w-4 h-4" />}
                >
                  Connect Wallet
                </Button>
              </div>
            ) : stakesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-3 text-sm text-slate-500">Loading stakes...</span>
              </div>
            ) : userStakes.length === 0 ? (
              <div className="text-center py-8">
                <Lock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No active stakes found
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Stake DIBS tokens to start earning rewards
                </p>
              </div>
            ) : (
              <>
                {/* Stakes summary */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Staked
                  </span>
                  <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    {totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS
                  </span>
                </div>

                {/* Individual stakes */}
                <div className="space-y-2">
                  {userStakes.map((stake) => {
                    const releaseTimeNum = Number(stake.releaseTime);
                    const isUnlocked = now >= releaseTimeNum;
                    const isClaimed = stake.claimed;
                    const amountNum = Number(formatUnits(stake.amount, 18));

                    return (
                      <div
                        key={stake.index}
                        className={`p-4 rounded-xl border transition-all ${
                          isClaimed
                            ? "bg-slate-50 dark:bg-[#121826]/30 border-slate-200 dark:border-slate-800 opacity-60"
                            : isUnlocked
                              ? "bg-success/5 border-success/20"
                              : "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200/30 dark:border-amber-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
                            {amountNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isClaimed
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                : isUnlocked
                                  ? "bg-success/15 text-success"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {isClaimed ? "Claimed" : isUnlocked ? "✅ Ready" : "Locked"}
                          </span>
                        </div>
                        {!isClaimed && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs">
                            <TrendingUp className="w-3 h-3 text-primary" />
                            <span className="font-medium text-primary">
                              {(Number(stake.apyRate) / 100).toFixed(1)}% APY
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">
                              &middot; {Number(stake.lockDays)}d lock
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">&middot;</span>
                            <span className="text-slate-400 dark:text-slate-500">Reward:</span>
                            <span className="font-medium text-success">
                              +{((amountNum * Number(stake.apyRate) * Number(stake.lockDays)) / (365 * 10000)).toFixed(2)} DIBS
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            {isClaimed
                              ? `Released ${formatReleaseDate(stake.releaseTime)}`
                              : formatCountdown(stake.releaseTime)}
                          </span>
                          {!isClaimed && isUnlocked && (
                            <Button
                              size="sm"
                              onClick={() => executeUnstake(stake.index)}
                              loading={unstakingIndex === stake.index}
                              disabled={unstakingIndex !== null}
                              icon={unstakingIndex !== stake.index ? <ArrowDown className="w-3 h-3" /> : undefined}
                            >
                              {unstakingIndex === stake.index ? "Unstaking..." : "Unstake"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </GlassCard>
        )}
      </div>

      {/* ===== STAKE CONFIRMATION MODAL ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          />
          {/* Modal */}
          <div className="tooltip-card relative w-full max-w-sm rounded-2xl shadow-2xl p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Confirm Stake
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning content */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200/90 mb-1">
                    Are you sure?
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-200/70">
                    Your tokens will be locked for{" "}
                    <span className="font-bold">{selectedLockPeriod.days} days</span>.
                    This action cannot be undone during the lock period.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Amount</span>
                  <span className="font-semibold text-slate-950 dark:text-slate-50">
                    {stakeAmountNum.toLocaleString()} DIBS
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Lock Period</span>
                  <span className="font-semibold text-slate-950 dark:text-slate-50">
                    {selectedLockPeriod.days} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">APY</span>
                  <span className="font-semibold text-success">{selectedLockPeriod.apy}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Preview Yield</span>
                  <span className="font-semibold text-success text-xs">
                    +{((stakeAmountNum * parseFloat(selectedLockPeriod.apy) * selectedLockPeriod.days) / (365 * 100)).toFixed(2)} DIBS{" "}
                    <span className="text-slate-400 font-normal text-[10px]">({selectedLockPeriod.apy} APY)</span>
                  </span>
                </div>
              </div>

              {/* Confirm button */}
              <Button
                size="lg"
                className="w-full"
                onClick={executeStake}
                loading={isStaking}
                icon={!isStaking ? <Lock className="w-4 h-4" /> : undefined}
              >
                {isStaking ? "Confirming..." : "Confirm & Lock Tokens"}
              </Button>

              {/* Cancel */}
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
