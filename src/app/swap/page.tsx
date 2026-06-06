"use client";

import { ArrowLeftRight, Info, AlertTriangle } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { parseUnits, createPublicClient, http, formatEther, formatUnits, createWalletClient, custom, decodeEventLog } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import {
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
  EXCHANGE_RATE,
  ARC_TESTNET_CHAIN_ID,
  ARC_EXPLORER_URL,
  vaultABI,
  dibsBalanceOfABI,
  erc20ApproveABI,
  switchToArcTestnet,
} from "@/vaultConfig";

const fallbackPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export default function SwapPage() {
  const { authenticated, user } = usePrivy();
  const { wallets: swapWallets } = useWallets();

  const isWalletConnected = (authenticated && !!user?.wallet?.address) || swapWallets.length > 0;

  const activeSwapWallet = swapWallets[0];
  const activeSwapChainId = activeSwapWallet
    ? Number(activeSwapWallet.chainId.replace('eip155:', ''))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeSwapChainId !== null &&
    activeSwapChainId !== ARC_TESTNET_CHAIN_ID;

  const userAddress = (swapWallets[0]?.address as `0x${string}` | undefined);

  // Dynamic provider state so balance reads & writes route through the active wallet
  const [swapWalletProvider, setSwapWalletProvider] = useState<any>(null);

  useEffect(() => {
    const wallet = swapWallets[0];
    if (!wallet) {
      setSwapWalletProvider(null);
      return;
    }
    let cancelled = false;
    wallet.getEthereumProvider().then((p: any) => {
      if (!cancelled) setSwapWalletProvider(p);
    }).catch(() => {
      if (!cancelled) setSwapWalletProvider(null);
    });
    return () => { cancelled = true; };
  }, [swapWallets]);

  // Helper that builds a public client through the active wallet when available
  const getPublicClient = useCallback(() => {
    if (swapWalletProvider) {
      return createPublicClient({ chain: arcTestnet, transport: custom(swapWalletProvider) });
    }
    return fallbackPublicClient;
  }, [swapWalletProvider]);

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
        const client = getPublicClient();
        const bal = await client.getBalance({ address: userAddress });
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
        const client = getPublicClient();
        const bal = await client.readContract({
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
    // DIBS to USDC: show approximate USDC output
    return (parsed / EXCHANGE_RATE).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  }, [swapInput, fromToken]);

  const isValidInput = swapInput !== "" && parseFloat(swapInput) > 0;

  // --- Balance overdraw check ---
  const swapInputNum = parseFloat(swapInput) || 0;
  const isOverBalance =
    fromToken === "DIBS"
      ? swapInputNum > dibsBalanceNum
      : swapInputNum > gasBalance;

  // --- Vault DIBS liquidity check ---
  const [vaultDibsBalance, setVaultDibsBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!isWalletConnected) {
      setVaultDibsBalance(null);
      return;
    }
    let cancelled = false;
    const fetchVaultLiquidity = async () => {
      try {
        const client = getPublicClient();
        const bal = await client.readContract({
          address: DIBS_CONTRACT_ADDRESS,
          abi: dibsBalanceOfABI,
          functionName: "balanceOf",
          args: [VAULT_ADDRESS],
        });
        if (!cancelled) setVaultDibsBalance(bal);
      } catch {
        if (!cancelled) setVaultDibsBalance(null);
      }
    };
    fetchVaultLiquidity();
    const interval = setInterval(fetchVaultLiquidity, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isWalletConnected]);

  // Compute expected DIBS output directly (avoid toLocaleString → parseFloat roundtrip)
  const expectedDibsOutput = useMemo(() => {
    const parsed = parseFloat(swapInput);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return fromToken === "USDC" ? parsed * EXCHANGE_RATE : 0;
  }, [swapInput, fromToken]);

  const vaultHasLiquidity =
    fromToken !== "USDC" ||
    vaultDibsBalance == null ||
    expectedDibsOutput <= 0 ||
    vaultDibsBalance >= parseUnits(expectedDibsOutput.toString(), 18);
  const isLowLiquidity =
    fromToken === "USDC" &&
    expectedDibsOutput > 0 &&
    vaultDibsBalance != null &&
    vaultDibsBalance < parseUnits(expectedDibsOutput.toString(), 18);

  const canSwap = isValidInput && !isOverBalance && vaultHasLiquidity;

  // --- Execute swap with receipt waiting and balance refresh ---
  const handleSwap = useCallback(async () => {
    if (!canSwap || swapWallets.length === 0) return;

    // Balance check toast before proceeding
    if (isOverBalance) {
      toast.error(`Insufficient ${fromToken} balance for this action.`);
      return;
    }

    setIsSwapping(true);
    try {
      const activeWallet = swapWallets[0];

      // Programmatically switch wallet to Arc Testnet (5042002) — works for both external and embedded wallets
      await switchToArcTestnet(activeWallet);

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      const isUsdcToDibs = fromToken === "USDC";

      await toast.promise(
        (async () => {
          let hash: `0x${string}`;

          if (isUsdcToDibs) {
            // USDC → DIBS: send native USDC with swapUsdcForDibs()
            hash = await walletClient.writeContract({
              address: VAULT_ADDRESS,
              abi: vaultABI,
              functionName: "swapUsdcForDibs",
              value: parseUnits(swapInput, 18),
            });
          } else {
            // DIBS → USDC: approve vault first, then call swapDibsForUsdc
            const amountWei = parseUnits(swapInput, 18);

            // Step 1: Approve vault to spend DIBS
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

            // Step 2: Swap DIBS for USDC
            hash = await walletClient.writeContract({
              address: VAULT_ADDRESS,
              abi: vaultABI,
              functionName: "swapDibsForUsdc",
              args: [amountWei],
            });
          }

          // Wait for on-chain confirmation
          const client = getPublicClient();
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error("Transaction Failed/Reverted");
          }

          // Parse AssetSwapped event to get actual amount received
          let actualAmountOut = "";
          try {
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: vaultABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === "AssetSwapped") {
                  const args = decoded.args as unknown as { amountOut: bigint };
                  actualAmountOut = formatUnits(args.amountOut, 18);
                  break;
                }
              } catch { /* not this event */ }
            }
          } catch { /* event parsing non-critical */ }

          // Immediately refresh balances
          if (userAddress) {
            try {
              const client = getPublicClient();
              const [newGas, newDibs] = await Promise.all([
                client.getBalance({ address: userAddress }),
                client.readContract({
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

          // Show explorer link as follow-up toast
          if (hash) {
            const tokenSymbol = isUsdcToDibs ? "DIBS" : "USDC";
            toast.success(
              actualAmountOut
                ? `Received ${Number(actualAmountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${tokenSymbol}`
                : "Transaction confirmed",
              {
                action: {
                  label: "Explorer",
                  onClick: () => window.open(`${ARC_EXPLORER_URL}/tx/${hash}`, "_blank"),
                },
              }
            );
          }

          return hash;
        })(),
        {
          loading: isUsdcToDibs
            ? "Swapping USDC for DIBS..."
            : "Swapping DIBS for USDC...",
          success: "Swap completed successfully!",
          error: (err) => {
            const e = err as Error & { code?: number; cause?: { code?: number } };
            if (e?.code === 4001 || e?.cause?.code === 4001 || String(e?.message || "").includes("User rejected")) {
              return "Transaction canceled by user";
            }
            const msg = e.message || "";
            return msg.includes("Transaction Failed/Reverted")
              ? "Transaction Failed/Reverted"
              : `Swap failed: ${msg.slice(0, 80)}`;
          },
        }
      );
      setSwapInput("");
    } catch {
      // toast already handled by toast.promise
    } finally {
      setIsSwapping(false);
    }
  }, [canSwap, swapWallets, swapInput, fromToken, userAddress]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Swap Tokens</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Trade USDC for $DIBS — and back — on Arc Testnet
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

          {/* Token Flip Arrow — interactive button */}
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
                : `1 DIBS ≈ ${(1 / EXCHANGE_RATE).toFixed(2)} USDC`}
            </span>
          </div>

          {/* Native USDC Balance Display */}
          {isWalletConnected && (
            <div className="input-box flex items-center justify-between px-3 py-2 rounded-lg">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Your USDC Balance
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {gasBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
              </span>
            </div>
          )}

          {/* Balance error */}
          {isOverBalance && (
            <p className="text-xs font-semibold text-error px-1">
              Insufficient {fromToken} balance.
            </p>
          )}

          {/* Vault liquidity warning */}
          {isLowLiquidity && (
            <p className="text-xs font-semibold text-error px-1 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              Transaction blocked: Vault has insufficient $DIBS liquidity.
            </p>
          )}

          {/* Action */}
          <Button
            size="lg"
            className="w-full"
            disabled={
              !isWalletConnected || !canSwap || isSwapping || isWrongNetwork || isLowLiquidity
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
