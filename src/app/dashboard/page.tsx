"use client";

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, CheckCircle, Loader2, Send, Lock, LogOut } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { useRouter } from "next/navigation";
import { createPublicClient, http, custom, formatUnits, parseAbiItem, decodeEventLog } from "viem";
import { toast } from "sonner";
import { arcTestnet } from "@/components/Web3Provider";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { SendModal } from "@/components/SendModal";
import {
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
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

type UserStake = {
  index: number;
  amount: bigint;
  releaseTime: bigint;
  apyRate: bigint;
  lockDays: bigint;
  claimed: boolean;
};

export default function DashboardPage() {
  const { authenticated, ready, user, login, logout } = usePrivy();
  const { wallets: dashboardWallets } = useWallets();


  const isUIActive = ready && (authenticated || (dashboardWallets && dashboardWallets.length > 0));

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

  // Numeric balance values for SendModal props
  const gasBalanceNum = useMemo(() => parseFloat(gasBalance) || 0, [gasBalance]);
  const dibsBalanceNum = useMemo(
    () => (dibsBalanceRaw != null ? parseFloat(formatUnits(dibsBalanceRaw, 18)) : 0),
    [dibsBalanceRaw]
  );

  // --- Send Modal visibility ---
  const [showSendModal, setShowSendModal] = useState(false);

  // Live countdown tracker for time-based badges
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Stakes state ---
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [stakesLoading, setStakesLoading] = useState(false);

  const router = useRouter();

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
        const count = (await client.readContract({
          address: VAULT_ADDRESS,
          abi: vaultABI,
          functionName: "getUserStakesCount",
          args: [userAddress],
        })) as bigint;

        const stakes: UserStake[] = [];
        for (let i = 0; i < Number(count); i++) {
          const raw = (await client.readContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "userStakes",
            args: [userAddress, BigInt(i)],
          })) as [bigint, bigint, bigint, bigint, boolean];

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
    const interval = setInterval(fetchStakes, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

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

  // Privy-native disconnect: logout() invalidates auth cookies and tears down
  // embedded wallets. A stray HTTP 400 from Privy's session-clear endpoint
  // must NOT halt the disconnect flow — wrap it in a try/catch so we always
  // fall through to the storage purge + hard reload below.
  const handleHardDisconnect = useCallback(async () => {
    try {
      await logout();
    } catch (e) {
      console.warn("Handled Privy session clear error gracefully:", e);
    }
    // Force a complete state purge and hard reload — guarantees the UI
    // returns to a clean state even if Privy's session-clear call fails.
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(window.location.origin);
  }, [logout]);

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
        const tokensStakedEventAbi = parseAbiItem("event TokensStaked(address indexed user, uint256 amount, uint256 releaseTime, uint256 apyRate, uint256 lockDays)");

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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Total Accumulated Yield
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {userStakes
                .filter((s) => !s.claimed)
                .reduce((sum, s) => {
                  const amt = Number(formatUnits(s.amount, 18));
                  return sum + (amt * Number(s.apyRate) * Number(s.lockDays)) / (365 * 10000);
                }, 0)
                .toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500">DIBS</span>
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {userStakes.filter((s) => !s.claimed).length > 0
                ? "Pending from active positions"
                : "Stake DIBS to earn yield"}
            </p>
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
            onClick={() => router.push("/stake")}
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

        {/* Active Positions */}
        {userStakes.filter((s) => !s.claimed).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                Active Positions
              </h2>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                {userStakes.filter((s) => !s.claimed).length} active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {userStakes
                .filter((s) => !s.claimed)
                .map((stake) => {
                  const releaseTimeNum = Number(stake.releaseTime);
                  const isUnlocked = now >= releaseTimeNum;
                  const amountNum = Number(formatUnits(stake.amount, 18));
                  const apyDisplay = (Number(stake.apyRate) / 100).toFixed(1);

                  const formatCountdown = (rt: bigint): { text: string; isReady: boolean } => {
                    const remaining = Number(rt) - now;
                    if (remaining <= 0) return { text: "✅ Ready to Claim", isReady: true };
                    const days = Math.floor(remaining / 86400);
                    const hours = Math.floor((remaining % 86400) / 3600);
                    if (days > 0) return { text: `⏳ Unlocks in ${days}d ${hours}h`, isReady: false };
                    const mins = Math.floor((remaining % 3600) / 60);
                    return { text: `⏳ Unlocks in ${hours}h ${mins}m`, isReady: false };
                  };

                  const countdown = formatCountdown(stake.releaseTime);

                  return (
                    <GlassCard
                      key={stake.index}
                      className={`p-4 border transition-all ${
                        isUnlocked ? "border-success/30 bg-success/[0.02]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
                          {amountNum.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          DIBS
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isUnlocked
                              ? "bg-success/15 text-success"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {countdown.isReady ? "✅ Ready" : "Locked"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block">
                            APY
                          </span>
                          <span className="font-semibold text-primary">
                            {apyDisplay}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block">
                            Duration
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {Number(stake.lockDays)}d
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block">
                            Unlocks
                          </span>
                          <span
                            className={`font-semibold text-[11px] ${countdown.isReady ? "text-success" : "text-amber-600 dark:text-amber-400"}`}
                          >
                            {countdown.text}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Est. Reward:
                        </span>
                        <span className="text-[11px] font-semibold text-success">
                          +{((amountNum * Number(stake.apyRate) * Number(stake.lockDays)) / (365 * 10000)).toFixed(2)} DIBS
                        </span>
                      </div>
                      {isUnlocked && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-success font-medium">
                            Ready to unstake — visit the{" "}
                            <a
                              href="/stake"
                              className="underline hover:text-success/80 transition-colors"
                            >
                              Stake page
                            </a>{" "}
                            to claim
                          </p>
                        </div>
                      )}
                    </GlassCard>
                  );
                })}
            </div>
          </div>
        )}

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
      />    </div>
  );
}
