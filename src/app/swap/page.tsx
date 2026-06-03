"use client";

import { ArrowLeftRight, Info, AlertTriangle } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { parseUnits, createPublicClient, http, formatEther, formatUnits, createWalletClient, custom } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";

const VAULT_ADDRESS = "0x3ed226184b4a00d1500e04f4fa89281107475597";
const DIBS_CONTRACT_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
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

export default function SwapPage() {
  const { authenticated, user } = usePrivy();
  const { wallets: swapWallets } = useWallets();

  const isWalletConnected = authenticated && !!user?.wallet?.address;

  const activeSwapWallet = swapWallets[0];
  const activeSwapChainId = activeSwapWallet
    ? Number(activeSwapWallet.chainId.replace('eip155:', ''))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeSwapChainId !== null &&
    activeSwapChainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = (user?.wallet?.address as `0x${string}` | undefined);

  // --- Token flip state ---
  const [fromToken, setFromToken] = useState<"USDC" | "DIBS">("USDC");
  const [toToken, setToToken] = useState<"USDC" | "DIBS">("DIBS");
  const [swapInput, setSwapInput] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState(false);

  // --- Fetch native gas balance ---
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

  // --- Fetch DIBS balance ---
  const [dibsBalanceRaw, setDibsBalanceRaw] = useState<bigint | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setDibsBalanceRaw(null);
      return;
    }
    let cancelled = false;
    const fetchDibs = async () => {
      try {
        const bal = await publicClient.readContract({
          address: DIBS_CONTRACT_ADDRESS,
          abi: dibsBalanceOfABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        if (!cancelled) setDibsBalanceRaw(bal);
      } catch {
        if (!cancelled) setDibsBalanceRaw(null);
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

  // --- 50% / MAX shortcuts (contextual to fromToken) ---
  const handleFiftyPercent = useCallback(() => {
    if (fromToken === "DIBS") {
      setSwapInput((dibsBalanceNum * 0.5).toString());
    } else {
      setSwapInput((gasBalance * 0.5).toString());
    }
  }, [fromToken, dibsBalanceNum, gasBalance]);

  const handleMax = useCallback(() => {
    if (fromToken === "DIBS") {
      setSwapInput(dibsBalanceNum.toString());
    } else {
      setSwapInput(Math.max(0, gasBalance - 0.01).toString());
    }
  }, [fromToken, dibsBalanceNum, gasBalance]);

  // --- Token flip arrow handler ---
  const handleTokenFlip = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setSwapInput("");
  }, [fromToken, toToken]);

  // --- Swap output calculation ---
  const swapOutput = useMemo(() => {
    const parsed = parseFloat(swapInput);
    if (isNaN(parsed) || parsed <= 0) return "0";
    if (fromToken === "USDC") {
      return (parsed * EXCHANGE_RATE).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
    }
    // DIBS to USDC not available
    return "0";
  }, [swapInput, fromToken]);

  const isValidInput = swapInput !== "" && parseFloat(swapInput) > 0;

  // --- Execute swap with receipt waiting and balance refresh ---
  const handleSwap = useCallback(async () => {
    if (!isValidInput || swapWallets.length === 0) return;

    // DIBS-to-USDC guard: prevent contract reverts during Testnet Alpha
    if (fromToken === "DIBS") {
      toast.error("DIBS to USDC liquidation is locked during the Testnet Alpha phase.");
      return;
    }

    setIsSwapping(true);
    try {
      const activeWallet = swapWallets[0];

      // Programmatically switch Privy embedded wallet to Arc Testnet (5042002)
      const currentChainId = Number(activeWallet.chainId.replace('eip155:', ''));
      if (currentChainId !== ARC_TESTNET_CHAIN_ID) {
        await activeWallet.switchChain(ARC_TESTNET_CHAIN_ID);
      }

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      await toast.promise(
        (async () => {
          const hash = await walletClient.writeContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "swapUsdcForDibs",
            value: parseUnits(swapInput, 6),
          });

          // Wait for on-chain confirmation before resolving the toast
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error("Transaction reverted on-chain");
          }

          // Immediately refresh balances so dashboard numbers update
          if (userAddress) {
            try {
              const [newGas, newDibs] = await Promise.all([
                publicClient.getBalance({ address: userAddress }),
                publicClient.readContract({
                  address: DIBS_CONTRACT_ADDRESS,
                  abi: dibsBalanceOfABI,
                  functionName: "balanceOf",
                  args: [userAddress],
                }),
              ]);
              setGasBalance(parseFloat(formatEther(newGas)));
              setDibsBalanceRaw(newDibs);
            } catch {
              // Non-critical — polling will catch up
            }
          }
        })(),
        {
          loading: "Swapping USDC for DIBS...",
          success: "Swap completed successfully!",
          error: (err) => `Swap failed: ${(err as Error).message.slice(0, 80)}`,
        }
      );
      setSwapInput("");
    } catch {
      // toast already handled
    } finally {
      setIsSwapping(false);
    }
  }, [swapInput, isValidInput, swapWallets, fromToken, userAddress]);

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
          {/* You Pay */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                You Pay
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
                value={swapInput}
                onChange={(e) => setSwapInput(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
              />
              <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold select-none">
                {fromToken}
              </span>
            </div>
          </div>

          {/* Token Flip Arrow — interactive button with mobile touch optimization */}
          <div className="flex justify-center">
            <button
              onClick={handleTokenFlip}
              className="input-box cursor-pointer select-none active:scale-95 p-2 rounded-xl text-amber-600 dark:text-primary hover:scale-110 transition-all"
              title="Flip tokens"
              aria-label="Flip token direction"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* You Receive */}
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
              You Receive
            </label>
            <div className="input-box relative flex items-center p-4">
              <input
                type="text"
                readOnly
                value={swapOutput}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none pr-20 tabular-nums"
              />
              <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold select-none">
                {toToken}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="input-box flex items-center gap-2 px-3 py-2 rounded-lg">
            <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {fromToken === "USDC"
                ? `1 USDC = ${EXCHANGE_RATE} DIBS`
                : "DIBS → USDC locked during Alpha"}
            </span>
          </div>

          {/* Action */}
          <Button
            size="lg"
            className="w-full"
            disabled={
              !isWalletConnected || !isValidInput || isSwapping || isWrongNetwork
            }
            loading={isSwapping}
            onClick={handleSwap}
            icon={
              !isSwapping ? <ArrowLeftRight className="w-4 h-4" /> : undefined
            }
          >
            {!isWalletConnected
              ? "Connect Wallet to Swap"
              : isSwapping
                ? "Swapping..."
                : "Execute Swap"}
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
