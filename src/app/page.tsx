"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { formatUnits, createPublicClient, http } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import QRCode from "react-qr-code";
import {
  Shield,
  Lock,
  AlertTriangle,
  TrendingUp,
  Coins,
  ArrowDown,
  ArrowRight,
  Clock,
  CheckCircle,
  Send,
  ArrowDownToLine,
  X,
  Copy,
  Plus,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { GlassCard } from "@/components/GlassCard";

const ARC_TESTNET_CHAIN_ID = 5042002;

// $DIBS ERC-20 Token Configuration
const DIBS_CONTRACT_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
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

// Standard ERC-20 read ABI for token import
const erc20ReadABI = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface TokenEntry {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  balance: string | null;
  isLoading: boolean;
}

const transactions = [
  {
    type: "Contract Interaction (Stake)",
    date: "May 24, 2026",
    amount: "50,000.00 DIBS",
    status: "Confirmed" as const,
    hash: "0x1a2b...3c4d",
  },
  {
    type: "Transfer Sent",
    date: "May 23, 2026",
    amount: "12,500.00 DIBS",
    status: "Confirmed" as const,
    hash: "0x5e6f...7g8h",
  },
  {
    type: "Token Received",
    date: "May 22, 2026",
    amount: "25,000.00 DIBS",
    status: "Pending" as const,
    hash: "0x9i0j...1k2l",
  },
];

export default function Home() {
  const { address: wagmiAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { authenticated, user } = usePrivy();

  const isWalletConnected = isConnected || (authenticated && !!user?.wallet?.address);
  const displayAddress = wagmiAddress || user?.wallet?.address;
  const userAddress = (user?.wallet?.address as `0x${string}` | undefined) ??
    (wagmiAddress as `0x${string}` | undefined);
  const isWrongNetwork = isConnected && chainId !== ARC_TESTNET_CHAIN_ID;

  // --- Live $DIBS Balance Fetching (polls every 8 seconds) ---
  const { data: dibsBalanceRaw, isLoading: dibsBalanceLoading } = useReadContract({
    address: DIBS_CONTRACT_ADDRESS,
    abi: dibsBalanceOfABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
      refetchInterval: 8000,
    },
  });

  const dibsBalanceFormatted = dibsBalanceRaw != null
    ? formatUnits(dibsBalanceRaw, 18)
    : null;
  const dibsBalanceDisplay = dibsBalanceFormatted !== null
    ? Number(dibsBalanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : null;

  // --- Receive modal state ---
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveCopied, setReceiveCopied] = useState(false);

  const handleCopyReceive = useCallback(async () => {
    if (!displayAddress) return;
    try {
      await navigator.clipboard.writeText(displayAddress);
      setReceiveCopied(true);
      setTimeout(() => setReceiveCopied(false), 2000);
    } catch {
      // noop
    }
  }, [displayAddress]);

  // --- Dynamic Token Registry ---
  const [tokenList, setTokenList] = useState<TokenEntry[]>([
    {
      name: "USDC Gas",
      symbol: "USDC",
      decimals: 6,
      address: "Native",
      balance: null,
      isLoading: true,
    },
    {
      name: "DibsCoin",
      symbol: "DIBS",
      decimals: 18,
      address: DIBS_CONTRACT_ADDRESS,
      balance: null,
      isLoading: true,
    },
  ]);

  // Sync native gas balance into tokenList
  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;
    const fetchNative = async () => {
      try {
        const bal = await publicClient.getBalance({ address: userAddress });
        if (!cancelled) {
          const formatted = formatUnits(bal, 6);
          setTokenList((prev) =>
            prev.map((t) =>
              t.address === "Native"
                ? { ...t, balance: formatted, isLoading: false }
                : t
            )
          );
        }
      } catch {
        if (!cancelled) {
          setTokenList((prev) =>
            prev.map((t) =>
              t.address === "Native"
                ? { ...t, balance: null, isLoading: false }
                : t
            )
          );
        }
      }
    };
    fetchNative();
    const interval = setInterval(fetchNative, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  // Sync $DIBS balance into tokenList
  useEffect(() => {
    setTokenList((prev) =>
      prev.map((t) =>
        t.address === DIBS_CONTRACT_ADDRESS
          ? {
              ...t,
              balance: dibsBalanceFormatted,
              isLoading: dibsBalanceLoading,
            }
          : t
      )
    );
  }, [dibsBalanceFormatted, dibsBalanceLoading]);

  // --- Custom Token Import ---
  const [importAddress, setImportAddress] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    const trimmed = importAddress.trim();
    if (!trimmed || !trimmed.startsWith("0x") || trimmed.length !== 42)
      return;
    if (
      tokenList.some((t) => t.address.toLowerCase() === trimmed.toLowerCase())
    ) {
      setImportError("Token already in registry");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const addr = trimmed as `0x${string}`;
      const [symbol, decimals, balance] = await Promise.all([
        publicClient.readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "decimals",
        }),
        userAddress
          ? publicClient.readContract({
              address: addr,
              abi: erc20ReadABI,
              functionName: "balanceOf",
              args: [userAddress],
            })            : Promise.resolve(BigInt(0)),
      ]);
      const balanceFormatted = formatUnits(balance as bigint, decimals as number);
      setTokenList((prev) => [
        ...prev,
        {
          name: symbol as string,
          symbol: symbol as string,
          decimals: decimals as number,
          address: trimmed,
          balance: balanceFormatted,
          isLoading: false,
        },
      ]);
      setImportAddress("");
    } catch {
      setImportError("Invalid ERC-20 token address");
    } finally {
      setImportLoading(false);
    }
  }, [importAddress, userAddress, tokenList]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showReceiveModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showReceiveModal]);

  return (
    <div className="flex flex-col flex-1">
      {/* Wrong Network Warning Banner */}
      {isWrongNetwork && (
        <div className="sticky top-16 z-40 flex items-center justify-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            You are connected to an unsupported network. Please switch to Arc
            Testnet (Chain ID: {ARC_TESTNET_CHAIN_ID}) in your wallet.
          </p>
        </div>
      )}

      <section className="relative flex-1 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-10">
          {/* ===== DASHBOARD VIEW ===== */}
          <div
            className={`space-y-8 transition-all duration-500 ${
              !isWalletConnected ? "blur-[4px] select-none pointer-events-none" : ""
            }`}
          >
            {/* Balance Hero Card */}
            <GlassCard className="p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.04] rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Portfolio Value
                    </p>
                    <div className="flex items-baseline gap-3 mt-1">
                      <h1
                        className="text-4xl sm:text-5xl font-bold text-slate-950 dark:text-slate-50 tracking-tight tabular-nums"
                        style={{
                          textShadow:
                            "0 0 40px rgba(124, 58, 237, 0.15)",
                        }}
                      >
                        {dibsBalanceLoading
                          ? "..."
                          : dibsBalanceDisplay ?? "—"}
                      </h1>
                      <span className="text-xl sm:text-2xl font-semibold text-slate-600 dark:text-slate-300">
                        DIBS
                      </span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50 tabular-nums">
                      {dibsBalanceDisplay !== null
                        ? `${dibsBalanceDisplay} DIBS`
                        : dibsBalanceLoading
                          ? "Loading..."
                          : "—"}
                    </p>
                    <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-success/10 border border-success/20">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-xs font-semibold text-success">
                        +1.5% (24h)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    {displayAddress
                      ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                      : "Connected"}
                  </span>
                </div>

                {/* Send / Receive Action Sub-Row */}
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-950 dark:bg-slate-50 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-sm flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={() => setShowReceiveModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all shadow-sm flex-shrink-0"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Receive
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Token Registry Asset Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tokenList.map((token) => (
                <div
                  key={token.address}
                  className="rounded-xl bg-slate-100 dark:bg-[#1E293B]/50 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-6 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {token.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-slate-950 dark:text-slate-50 tabular-nums">
                    {token.isLoading
                      ? "..."
                      : token.balance !== null
                        ? Number(token.balance).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {token.symbol}
                  </p>
                </div>
              ))}

              {/* Import Custom Token Card */}
              <div className="rounded-xl bg-slate-100 dark:bg-[#1E293B]/50 backdrop-blur-md border border-dashed border-slate-300 dark:border-slate-600 p-6">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Import Custom Token Address
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={importAddress}
                    onChange={(e) => {
                      setImportAddress(e.target.value);
                      setImportError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleImport();
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400 focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={handleImport}
                    disabled={importLoading || !importAddress.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5 flex-shrink-0"
                  >
                    {importLoading ? (
                      "..."
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Import
                  </button>
                </div>
                {importError && (
                  <p className="text-[10px] text-error mt-2">{importError}</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Recent Activity
                </h3>
                <button className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                  View All
                </button>
              </div>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                        Date
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
                    {transactions.map((tx, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
                              {tx.type.includes("Stake") ? (
                                <Coins className="w-3.5 h-3.5 text-primary" />
                              ) : tx.type.includes("Sent") ? (
                                <ArrowRight className="w-3.5 h-3.5 text-warning -rotate-45" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-success" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-slate-950 dark:text-slate-50 truncate max-w-[140px]">
                              {tx.type}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              {tx.date}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <span className="text-xs font-mono font-medium text-slate-950 dark:text-slate-50">
                            {tx.amount}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              tx.status === "Confirmed"
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-warning/10 text-warning border border-warning/20"
                            }`}
                          >
                            {tx.status === "Confirmed" ? (
                              <CheckCircle className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* ===== LOCKED OVERLAY (when no wallet connected) ===== */}
          {!isWalletConnected && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/60 rounded-2xl px-8 py-7 text-center max-w-md mx-4 shadow-2xl">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50 mb-2">
                  ARCTOR Terminal Locked
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Use the command bar options above to connect your institutional
                  wallet or sign in via email.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== RECEIVE MODAL OVERLAY ===== */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowReceiveModal(false)}
          />
          {/* Modal card */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Receive Funds
              </h3>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live SVG QR Code */}
            <div className="mb-6 p-8 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <QRCode
                value={user?.wallet?.address || ""}
                size={180}
                fgColor="#D4AF37"
                bgColor="transparent"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Scan QR Code to Fund Account
              </span>
            </div>

            {/* Wallet Address Display + Copy */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Your Wallet Address
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                  {displayAddress || "—"}
                </code>
                <button
                  onClick={handleCopyReceive}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex-shrink-0"
                  title="Copy address"
                >
                  {receiveCopied ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowReceiveModal(false)}
              className="mt-6 w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
