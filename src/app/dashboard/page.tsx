"use client";

import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, http, formatUnits, parseAbiItem } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
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

interface ActivityEntry {
  type: string;
  hash: string;
  amount: string;
}

export default function DashboardPage() {
  const { authenticated, user, login } = usePrivy();
  const { wallets: dashboardWallets } = useWallets();

  const isWalletConnected = authenticated && !!user?.wallet?.address;

  const activeDashboardWallet = dashboardWallets[0];
  const activeDashboardChainId = activeDashboardWallet
    ? Number(activeDashboardWallet.chainId.replace("eip155:", ""))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeDashboardChainId !== null &&
    activeDashboardChainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = user?.wallet?.address as `0x${string}` | undefined;

  // --- Balances ---
  const [dibsBalanceRaw, setDibsBalanceRaw] = useState<bigint | null>(null);
  const [gasBalance, setGasBalance] = useState<string>("0");

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
          publicClient.readContract({
            address: DIBS_CONTRACT_ADDRESS,
            abi: dibsBalanceOfABI,
            functionName: "balanceOf",
            args: [userAddress],
          }),
          publicClient.getBalance({ address: userAddress }),
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

  // --- Staked Balance (tracked locally, synced from main page's stake modal) ---
  const [stakedBalance] = useState(0);

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
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(10000) > BigInt(0) ? currentBlock - BigInt(10000) : BigInt(0);
        const transferEventAbi = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { from: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          publicClient.getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { to: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        const newEntries: ActivityEntry[] = [];

        for (const log of sentLogs) {
          const { transactionHash, args } = log as unknown as { transactionHash: string; args: { from: string; to: string; value: bigint } };
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          const amount = formatUnits(args.value, 18);
          newEntries.push({
            type: "Transfer Sent",
            hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
            amount: `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`,
          });
        }

        for (const log of receivedLogs) {
          const { transactionHash, args } = log as unknown as { transactionHash: string; args: { from: string; to: string; value: bigint } };
          if (args.from.toLowerCase() === userAddress.toLowerCase()) continue;
          if (seenHashes.has(transactionHash)) continue;
          seenHashes.add(transactionHash);
          const amount = formatUnits(args.value, 18);
          newEntries.push({
            type: "Token Received",
            hash: `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`,
            amount: `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS`,
          });
        }

        if (newEntries.length > 0 && !cancelled) {
          setActivityLogs((prev) => [...newEntries.reverse(), ...prev].slice(0, 10));
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
              {isWalletConnected ? `${dibsBalanceFormatted} DIBS` : "$0.00"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              {isWalletConnected ? `${gasBalanceFormatted} USDC Gas` : "0 DIBS / 0 ETH"}
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
              {stakedBalance > 0 ? `${stakedBalance.toLocaleString()} DIBS` : "0 DIBS"}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">0.00 DIBS earned</p>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Sent
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {activityLogs.filter((a) => a.type === "Transfer Sent").length}
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
              {activityLogs.filter((a) => a.type === "Token Received").length}
            </p>
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

          {!isWalletConnected ? (
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
                      Transaction
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((tx, i) => (
                    <tr
                      key={tx.hash + i}
                      className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
                            {tx.type.includes("Sent") ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-warning" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5 text-success" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-950 dark:text-slate-50 truncate max-w-[140px]">
                            {tx.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <span className="text-xs font-mono font-medium text-slate-950 dark:text-slate-50">
                          {tx.amount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
