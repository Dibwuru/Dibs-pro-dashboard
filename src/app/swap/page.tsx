"use client";

import { ArrowLeftRight, Info, AlertTriangle } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAccount, useWriteContract, useChainId } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { parseUnits, createPublicClient, http, formatEther } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

const VAULT_ADDRESS = "0x3ed226184b4a00d1500e04f4fa89281107475597";
const EXCHANGE_RATE = 10; // 1 USDC = 10 DIBS
const ARC_TESTNET_CHAIN_ID = 5042002;

const vaultABI = [
  {
    type: "function",
    name: "swapUsdcForDibs",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export default function SwapPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { authenticated, user } = usePrivy();
  const isWalletConnected =
    isConnected || (authenticated && !!user?.wallet?.address);
  const isWrongNetwork = isConnected && chainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = (user?.wallet?.address as `0x${string}` | undefined);

  const [usdcInput, setUsdcInput] = useState<string>("");
  const { writeContractAsync, isPending } = useWriteContract();

  // --- Fetch native gas balance for 50%/MAX shortcuts ---
  const [gasBalance, setGasBalance] = useState<number>(0);

  useEffect(() => {
    if (!userAddress) {
      setGasBalance(0);
      return;
    }
    let cancelled = false;
    const fetchGas = async () => {
      try {
        const bal = await publicClient.getBalance({ address: userAddress });
        if (!cancelled) {
          setGasBalance(parseFloat(formatEther(bal)));
        }
      } catch {
        if (!cancelled) setGasBalance(0);
      }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  const handleFiftyPercent = useCallback(() => {
    setUsdcInput((gasBalance * 0.5).toString());
  }, [gasBalance]);

  const handleMax = useCallback(() => {
    setUsdcInput(Math.max(0, gasBalance - 0.01).toString());
  }, [gasBalance]);

  const dibsOutput = useMemo(() => {
    const parsed = parseFloat(usdcInput);
    if (isNaN(parsed) || parsed <= 0) return "0";
    return (parsed * EXCHANGE_RATE).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }, [usdcInput]);

  const isValidInput = usdcInput !== "" && parseFloat(usdcInput) > 0;

  const handleSwap = useCallback(async () => {
    if (!isValidInput) return;
    try {
      await toast.promise(
        writeContractAsync({
          address: VAULT_ADDRESS,
          abi: vaultABI,
          functionName: "swapUsdcForDibs",
          value: parseUnits(usdcInput, 6),
        }),
        {
          loading: "Swapping USDC for DIBS...",
          success: "Swap completed successfully!",
          error: (err) => `Swap failed: ${(err as Error).message.slice(0, 80)}`,
        }
      );
      setUsdcInput("");
    } catch {
      // toast already handled
    }
  }, [usdcInput, isValidInput, writeContractAsync]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Swap Tokens</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Trade USDC for $DIBS on the Arc Testnet
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

        {/* Swap Card */}
        <GlassCard className="space-y-4">
          {/* You Pay — USDC */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                You Pay
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleFiftyPercent}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all"
                >
                  50%
                </button>
                <button
                  onClick={handleMax}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="relative flex items-center bg-slate-100 dark:bg-[#121826] rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <input
                type="number"
                placeholder="0.0"
                value={usdcInput}
                onChange={(e) => setUsdcInput(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-200 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-amber-600 dark:text-primary">
                USDC
              </span>
            </div>
          </div>

          {/* Switch Arrow */}
          <div className="flex justify-center">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-primary">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>

          {/* You Receive — DIBS (auto-calculated) */}
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
              You Receive
            </label>
            <div className="relative flex items-center bg-slate-100 dark:bg-[#121826] rounded-xl p-4 border border-slate-200 dark:border-slate-800">
              <input
                type="text"
                readOnly
                value={dibsOutput}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none pr-20 tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-200 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-amber-600 dark:text-primary">
                DIBS
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#121826]/30 border border-slate-200 dark:border-slate-800">
            <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              1 USDC = {EXCHANGE_RATE} DIBS
            </span>
          </div>

          {/* Action */}
          <Button
            size="lg"
            className="w-full"
            disabled={
              !isWalletConnected || !isValidInput || isPending || isWrongNetwork
            }
            loading={isPending}
            onClick={handleSwap}
            icon={
              !isPending ? <ArrowLeftRight className="w-4 h-4" /> : undefined
            }
          >
            {!isWalletConnected
              ? "Connect Wallet to Swap"
              : isPending
                ? "Swapping..."
                : "Execute Swap"}
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
