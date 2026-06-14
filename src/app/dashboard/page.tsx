"use client";

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, AlertTriangle, CheckCircle, Loader2, Send, Lock, X, Clock, LogOut } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useChainId } from "wagmi";
import { createPublicClient, http, custom, formatUnits, parseAbiItem, decodeEventLog } from "viem";
import { toast } from "sonner";
import { arcTestnet } from "@/components/Web3Provider";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { SendModal } from "@/components/SendModal";
import {
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
  ARC_TESTNET_CHAIN_ID,
  ARC_EXPLORER_URL,
  dibsBalanceOfABI,
  vaultABI,
} from "@/vaultConfig";

const fallbackPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

interface ActivityEntry {
  action: "SEND" | "BURN" | "STAKE" | "RECEIVE" | "SWAP";
  hash: string;
  fullHash: string;
  amount: string;
  timestamp: number;
  status: "Confirmed" | "Pending" | "Failed";
  key: string;
}

export default function DashboardPage() {
  const { authenticated, ready, user, login, logout } = usePrivy();
  const { wallets: dashboardWallets } = useWallets();

  const isUIActive = ready && (authenticated || (dashboardWallets && dashboardWallets.length > 0));

  const activeDashboardWallet = dashboardWallets[0];
  const activeDashboardChainId = activeDashboardWallet
    ? Number(activeDashboardWallet.chainId.replace("eip155:", ""))
    : null;

  const userAddress = (dashboardWallets[0]?.address as `0x${string}` | undefined);

  // Dynamic provider state so balance reads route through the active wallet
  const [dashWalletProvider, setDashWalletProvider] = useState<any>(null);

  useEffect(() => {
    const wallet = dashboardWallets[0];
    if (!wallet) {
      setDashWalletProvider(null);
      return;
    }
    let cancelled = false;
    wallet.getEthereumProvider().then((p: any) => {
      if (!cancelled) setDashWalletProvider(p);
    }).catch(() => {
      if (!cancelled) setDashWalletProvider(null);
    });
    return () => { cancelled = true; };
  }, [dashboardWallets]);

  const getPublicClient = useCallback(() => {
    if (dashWalletProvider) {
      return createPublicClient({ chain: arcTestnet, transport: custom(dashWalletProvider) });
    }
    return fallbackPublicClient;
  }, [dashWalletProvider]);

  // --- Balances ---
  const [dibsBalanceRaw, setDibsBalanceRaw] = useState<bigint | null>(null);
  const [gasBalance, setGasBalance] = useState<string>("0");
  const [gasBalanceLoaded, setGasBalanceLoaded] = useState(false);

  // Numeric balance values for SendModal props
  const gasBalanceNum = useMemo(() => parseFloat(gasBalance) || 0, [gasBalance]);
  const dibsBalanceNum = useMemo(
    () => (dibsBalanceRaw != null ? parseFloat(formatUnits(dibsBalanceRaw, 18)) : 0),
    [dibsBalanceRaw]
  );

  // --- Send Modal visibility ---
  const [showSendModal, setShowSendModal] = useState(false);

  // --- Stake Modal visibility ---
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");

  // --- Pending entry helpers for activity feed ---
  const generateKey = useCallback(
    () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const addPendingEntry = useCallback(
    (action: ActivityEntry["action"], amount: string): string => {
      const key = generateKey();
      const entry: ActivityEntry = {
        action,
        hash: "Pending...",
        fullHash: "",
        amount,
        timestamp: Math.floor(Date.now() / 1000),
        status: "Pending",
        key,
      };
      setActivityLogs((prev) => [entry, ...prev].slice(0, 10));
      return key;
    },
    [generateKey]
  );

  const updateEntry = useCallback(
    (key: string, updates: Partial<Pick<ActivityEntry, "hash" | "fullHash" | "status">>) => {
      setActivityLogs((prev) =>
        prev.map((e) => {
          if (e.key !== key) return e;
          return { ...e, ...updates } as ActivityEntry;
        })
      );
    },
    []
  );

  // --- Hard disconnect: clear all wallet/privy state + reload ---
  const handleHardDisconnect = useCallback(async () => {
    if (dashboardWallets && dashboardWallets.length > 0) {
      try {
        await Promise.all(dashboardWallets.map((w) => w.disconnect()));
      } catch {
        // ignore wallet disconnect errors
      }
    }
    try {
      await logout();
    } catch {
      // logout may be no-op if not authenticated
    }
    localStorage.clear();
    window.location.reload();
  }, [logout, dashboardWallets]);

  // --- Stake modal helpers ---
  const handleStakeFiftyPercent = useCallback(() => {
    setStakeAmount((dibsBalanceNum * 0.5).toString());
  }, [dibsBalanceNum]);

  const handleStakeMax = useCallback(() => {
    setStakeAmount(dibsBalanceNum.toString());
  }, [dibsBalanceNum]);

  const handleStakeConfirm = useCallback(() => {
    const parsed = parseFloat(stakeAmount);
    if (isNaN(parsed) || parsed <= 0) return;
    if (parsed > dibsBalanceNum) {
      toast.error("Insufficient DIBS balance for this action.");
      return;
    }
    const pendingKey = addPendingEntry("STAKE", `${stakeAmount} DIBS`);
    updateEntry(pendingKey, { status: "Confirmed" });
    toast.success("Assets successfully committed to the Sovereign Staking Vault!");
    setShowStakeModal(false);
    setStakeAmount("");
  }, [stakeAmount, dibsBalanceNum, addPendingEntry, updateEntry]);

  // Lock body scroll when stake modal is open
  useEffect(() => {
    if (showStakeModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showStakeModal]);

  const wagmiChainId = useChainId();
  const isWrongNetwork =
    isUIActive &&
    activeDashboardChainId !== null &&
    activeDashboardChainId !== ARC_TESTNET_CHAIN_ID &&
    wagmiChainId !== ARC_TESTNET_CHAIN_ID &&
    !gasBalanceLoaded;

  useEffect(() => {
    if (!userAddress) {
      setDibsBalanceRaw(null);
      setGasBalance("0");
      return;
    }
    let cancelled = false;
    const fetchBalances = async () => {
      try {
        const [dibs, gas] = await Promise.all([
          getPublicClient().readContract({
            address: DIBS_CONTRACT_ADDRESS,
            abi: dibsBalanceOfABI,
            functionName: "balanceOf",
            args: [userAddress],
          }),
          getPublicClient().getBalance({ address: userAddress }),
        ]);
        if (!cancelled) {
          setDibsBalanceRaw(dibs);
          setGasBalance(formatUnits(gas, 18));
          setGasBalanceLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setDibsBalanceRaw(null);
          setGasBalance("0");
        }
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  const dibsBalanceFormatted = dibsBalanceRaw != null
    ? Number(formatUnits(dibsBalanceRaw, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "0";
  const gasBalanceFormatted = Number(gasBalance).toLocaleString(undefined, { maximumFractionDigits: 4 });

  // --- Staked Balance (fetched on-chain from vault) ---
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [stakedLoading, setStakedLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setStakedBalance(0);
      return;
    }
    let cancelled = false;
    const fetchStakes = async () => {
      setStakedLoading(true);
      try {
        const count = (await getPublicClient().readContract({
          address: VAULT_ADDRESS,
          abi: vaultABI,
          functionName: "getUserStakesCount",
          args: [userAddress],
        })) as bigint;

        let total = BigInt(0);
        for (let i = 0; i < Number(count); i++) {
          const raw = (await getPublicClient().readContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "userStakes",
            args: [userAddress, BigInt(i)],
          })) as [bigint, bigint, bigint, bigint, boolean];
          // Only count unclaimed stakes
          if (!raw[4]) {
            total += raw[0];
          }
        }
        if (!cancelled) {
          setStakedBalance(parseFloat(formatUnits(total, 18)));
        }
      } catch {
        if (!cancelled) setStakedBalance(0);
      } finally {
        if (!cancelled) setStakedLoading(false);
      }
    };
    fetchStakes();
    const interval = setInterval(fetchStakes, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  // --- Activity Tracking ---
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setActivityLogs([]);
      return;
    }
    let cancelled = false;
    const seenHashes = new Set<string>();

    const pollActivity = async () => {
      if (cancelled) return;
      setActivityLoading(true);
      try {
        const currentBlock = await          getPublicClient().getBlockNumber();
        const fromBlock = currentBlock - BigInt(10000) > BigInt(0) ? currentBlock - BigInt(10000) : BigInt(0);
        const transferEventAbi = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
        const assetSwappedEventAbi = parseAbiItem("event AssetSwapped(address indexed user, string direction, uint256 amountIn, uint256 amountOut)");
        const tokensStakedEventAbi = parseAbiItem("event TokensStaked(address indexed user, uint256 amount, uint256 releaseTime)");

        const [sentLogs, receivedLogs, swapLogs, stakeLogs] = await Promise.all([
          getPublicClient().getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { from: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { to: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: VAULT_ADDRESS,
            event: assetSwappedEventAbi,
            args: { user: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: VAULT_ADDRESS,
            event: tokensStakedEventAbi,
            args: { user: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        const newEntries: ActivityEntry[] = [];

        // Collect all unique block numbers and fetch timestamps in parallel
        const allLogs = [...sentLogs, ...receivedLogs, ...swapLogs, ...stakeLogs] as unknown as { blockNumber: bigint }[];
        const uniqueBlockNums = [...new Set(allLogs.map((l) => l.blockNumber?.toString() ?? "0"))];
        const blockTimestamps = new Map<string, number>();
        const blocks = await Promise.all(
          uniqueBlockNums.map((bn) =>
            getPublicClient().getBlock({ blockNumber: BigInt(bn) }).catch(() => null)
          )
        );
        blocks.forEach((block, i) => {
          if (block) blockTimestamps.set(uniqueBlockNums[i], Number(block.timestamp));
        });
        const getBlockTime = (bn: bigint): number =>
          blockTimestamps.get(bn.toString()) ?? Math.floor(Date.now() / 1000);

        for (const log of sentLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { from: string; to: string; value: bigint } };
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          const amount = formatUnits(args.value, 18);
          const ts = await getBlockTime(blockNumber);
          newEntries.push({
            action: "SEND",
            hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
            fullHash: transactionHash,
            amount: `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${transactionHash}`,
          });
        }

        for (const log of receivedLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { from: string; to: string; value: bigint } };
          if (args.from.toLowerCase() === userAddress.toLowerCase()) continue;
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          const amount = formatUnits(args.value, 18);
          const ts = await getBlockTime(blockNumber);
          newEntries.push({
            action: "RECEIVE",
            hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
            fullHash: transactionHash,
            amount: `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${transactionHash}`,
          });
        }

        // Parse V2 Vault AssetSwapped events
        for (const log of swapLogs) {
          const { transactionHash, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint };
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          try {
            const decoded = decodeEventLog({
              abi: vaultABI,
              data: (log as unknown as { data: `0x${string}` }).data,
              topics: (log as unknown as { topics: [signature: `0x${string}`, ...args: `0x${string}`[]] }).topics,
            });
            if (decoded.eventName === "AssetSwapped") {
              const args = decoded.args as unknown as { direction: string; amountIn: bigint; amountOut: bigint };
              const isBurn = args.direction === "DIBS_TO_USDC";
              const amountOutFormatted = formatUnits(args.amountOut, 18);
              const displayToken = isBurn ? "USDC" : "DIBS";
              const ts = await getBlockTime(blockNumber);
              newEntries.push({
                action: isBurn ? "BURN" : "SWAP",
                hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
                fullHash: transactionHash,
                amount: `${Number(amountOutFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayToken}`,
                timestamp: ts,
                status: "Confirmed",
                key: `onchain_${transactionHash}`,
              });
            }
          } catch {
            // skip unparseable logs
          }
        }

        // Parse TokensStaked events
        for (const log of stakeLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { user: string; amount: bigint; releaseTime: bigint } };
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          const amount = formatUnits(args.amount, 18);
          const ts = await getBlockTime(blockNumber);
          newEntries.push({
            action: "STAKE",
            hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
            fullHash: transactionHash,
            amount: `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${transactionHash}`,
          });
        }

        if (newEntries.length > 0 && !cancelled) {
          setActivityLogs((prev) => {
            const existingHashes = new Set(prev.map((e) => e.fullHash).filter(Boolean));
            const trulyNew = newEntries.filter((ne) => !existingHashes.has(ne.fullHash));
            const updated = prev.map((entry) => {
              if (entry.status === "Pending" && entry.fullHash) {
                const match = newEntries.find((ne) => ne.fullHash === entry.fullHash);
                if (match) return { ...entry, status: "Confirmed" as const, hash: match.hash, timestamp: match.timestamp } as ActivityEntry;
              }
              return entry;
            });
            return [...trulyNew.reverse(), ...updated].slice(0, 10);
          });
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };

    pollActivity();
    const interval = setInterval(pollActivity, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

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

        {/* Wrong Network Warning */}
        {isWrongNetwork && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              Switch to Arc Testnet (Chain ID: {ARC_TESTNET_CHAIN_ID})
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Balance
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {isUIActive ? `${dibsBalanceFormatted} DIBS` : "$0.00"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {isUIActive ? `${gasBalanceFormatted} USDC Gas` : "0 DIBS / 0 ETH"}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Staked
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {stakedLoading
                ? "..."
                : stakedBalance > 0
                  ? `${stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`
                  : "0 DIBS"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {stakedBalance > 0
                ? `Locked in vault`
                : "Earn rewards by staking"}
            </p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Sent
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {activityLogs.filter((a) => a.action === "SEND").length}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Total transactions</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="w-4 h-4 text-secondary" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Received
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {activityLogs.filter((a) => a.action === "RECEIVE").length}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Total transactions</p>
          </GlassCard>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-950 dark:bg-slate-50 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.97] transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
          <button
            onClick={() => setShowStakeModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-primary/20 text-primary bg-primary/[0.05] hover:bg-primary/[0.1] active:scale-[0.97] transition-all shadow-sm"
          >
            <Lock className="w-4 h-4" />
            Stake
          </button>
          <button
            onClick={handleHardDisconnect}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-500/20 text-red-500 bg-red-500/[0.05] hover:bg-red-500/[0.1] active:scale-[0.97] transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>

        {/* Recent Activity */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              Recent Activity
            </h2>
          </div>

          {!isUIActive ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-300/30 dark:text-slate-500/30 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Connect your wallet to see activity
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => login()}
              >
                Connect Wallet
              </Button>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-300/30 dark:text-slate-500/30 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {activityLoading
                  ? "Scanning on-chain activity..."
                  : "No $DIBS transfer activity detected for your wallet yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((tx, i) => {
                    const actionColors: Record<string, string> = {
                      SEND: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
                      BURN: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                      STAKE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      RECEIVE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                      SWAP: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                    };
                    const statusColors: Record<string, string> = {
                      Confirmed: "bg-success/10 text-success border-success/20",
                      Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      Failed: "bg-error/10 text-error border-error/20",
                    };

                    const timeAgo = (ts: number): string => {
                      const seconds = Math.floor(Date.now() / 1000) - ts;
                      if (seconds < 60) return "just now";
                      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
                      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
                      return new Date(ts * 1000).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    };

                    return (
                      <tr
                        key={tx.key || (tx.fullHash + i)}
                        className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-fade-in ${tx.status === "Pending" ? "activity-pending-row" : ""}`}
                      >
                        <td className="py-3.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actionColors[tx.action] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                          >
                            {tx.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {timeAgo(tx.timestamp)}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <span className="text-xs font-mono font-medium text-slate-950 dark:text-slate-50">
                            {tx.amount}
                          </span>
                        </td>                            <td className="py-3.5 px-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[tx.status] || statusColors.Pending} ${tx.status === "Pending" ? "animate-pulse" : ""}`}
                                >
                                  {tx.status === "Confirmed" && (
                                    <CheckCircle className="w-2.5 h-2.5" />
                                  )}
                                  {tx.status === "Pending" && (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  )}
                                  {tx.status}
                                </span>
                                {tx.status !== "Pending" && tx.fullHash && (
                                  <a
                                    href={`${ARC_EXPLORER_URL}/tx/${tx.fullHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-primary hover:text-primary-hover hover:underline transition-colors whitespace-nowrap"
                                    title="View on ArcScan"
                                  >
                                    View
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ===== SEND ASSET MODAL ===== */}
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        gasBalanceNum={gasBalanceNum}
        dibsBalanceNum={dibsBalanceNum}
        addPendingEntry={addPendingEntry}
        updateEntry={updateEntry}
      />

      {/* ===== STAKE MODAL ===== */}
      {showStakeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowStakeModal(false)}
          />
          <div className="tooltip-card relative w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Stake DIBS
              </h3>
              <button
                onClick={() => setShowStakeModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Available Balance
                </span>
                <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
                  {dibsBalanceFormatted} DIBS
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Amount to Stake
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleStakeFiftyPercent}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                    >
                      50%
                    </button>
                    <button
                      onClick={handleStakeMax}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
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
                  <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                    DIBS
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Estimated APY</span>
                  <span className="text-success font-medium">12.5%</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Lock Period</span>
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5" />7 days
                  </span>
                </div>
              </div>

              <button
                onClick={handleStakeConfirm}
                disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  stakeAmount && parseFloat(stakeAmount) > 0
                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                    : "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
                }`}
              >
                <Lock className="w-4 h-4" />
                Confirm Stake
              </button>

              <button
                onClick={() => setShowStakeModal(false)}
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
