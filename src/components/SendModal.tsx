"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import { AppKit } from "@circle-fin/app-kit";
import { ViemAdapter } from "@circle-fin/adapter-viem-v2";
import { toast } from "sonner";
import { Send, X } from "lucide-react";
import { DIBS_CONTRACT_ADDRESS, switchToArcTestnet } from "@/vaultConfig";

interface ActivityEntry {
  action: "SEND" | "BURN" | "STAKE" | "RECEIVE" | "SWAP";
  hash: string;
  fullHash: string;
  amount: string;
  timestamp: number;
  status: "Confirmed" | "Pending" | "Failed";
  key: string;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasBalanceNum: number;
  dibsBalanceNum: number;
  addPendingEntry: (action: ActivityEntry["action"], amount: string) => string;
  updateEntry: (
    key: string,
    updates: Partial<Pick<ActivityEntry, "hash" | "fullHash" | "status">>
  ) => void;
}

export function SendModal({
  isOpen,
  onClose,
  gasBalanceNum,
  dibsBalanceNum,
  addPendingEntry,
  updateEntry,
}: SendModalProps) {
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const userAddress = activeWallet?.address as `0x${string}` | undefined;

  const [sendAsset, setSendAsset] = useState<"USDC Gas" | "DibsCoin">(
    "USDC Gas"
  );
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);

  const isValidSend =
    sendRecipient.trim().startsWith("0x") &&
    sendRecipient.trim().length === 42 &&
    sendAmount !== "" &&
    parseFloat(sendAmount) > 0;

  const handleSendFiftyPercent = useCallback(() => {
    if (sendAsset === "DibsCoin") {
      setSendAmount((dibsBalanceNum * 0.5).toString());
    } else {
      setSendAmount((gasBalanceNum * 0.5).toString());
    }
  }, [sendAsset, dibsBalanceNum, gasBalanceNum]);

  const handleSendMax = useCallback(() => {
    if (sendAsset === "DibsCoin") {
      setSendAmount(dibsBalanceNum.toString());
    } else {
      setSendAmount(Math.max(0, gasBalanceNum - 0.01).toString());
    }
  }, [sendAsset, dibsBalanceNum, gasBalanceNum]);

  const handleClose = useCallback(() => {
    setSendRecipient("");
    setSendAmount("");
    onClose();
  }, [onClose]);

  const handleSendConfirm = useCallback(async () => {
    if (!isValidSend || !userAddress || !activeWallet) return;

    const sendAmt = parseFloat(sendAmount);
    if (sendAsset === "DibsCoin" && sendAmt > dibsBalanceNum) {
      toast.error("Insufficient DIBS balance for this action.");
      return;
    }
    if (sendAsset === "USDC Gas" && sendAmt > gasBalanceNum) {
      toast.error("Insufficient USDC balance for this action.");
      return;
    }

    setIsSending(true);
    const pendingAmount =
      sendAsset === "DibsCoin"
        ? `${sendAmount} DIBS`
        : `${sendAmount} USDC`;
    const pendingKey = addPendingEntry("SEND", pendingAmount);

    try {
      // Switch wallet to Arc Testnet before sending
      await switchToArcTestnet(activeWallet);

      // Dynamic Privy provider extraction — locked routing pattern
      const provider = await activeWallet.getEthereumProvider();

      // Build Viem clients from the Privy wallet provider
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: custom(provider),
      });

      // Wrap provider using the Viem v2 adapter
      const viemAdapter = new ViemAdapter(
        {
          getPublicClient: () => publicClient,
          getWalletClient: () => walletClient,
        },
        {} as any
      );

      // Instantiate Circle App Kit
      const kit = new AppKit();

      // Resolve token identifier: USDC alias or DIBS custom contract address
      const token =
        sendAsset === "DibsCoin" ? DIBS_CONTRACT_ADDRESS : "USDC";

      await toast.promise(
        (async () => {
          const result = await kit.send({
            from: { adapter: viemAdapter, chain: "Arc_Testnet" },
            to: sendRecipient.trim(),
            amount: sendAmount,
            token,
          });

          if (result.state !== "success") {
            updateEntry(pendingKey, { status: "Failed" });
            throw new Error("Transfer did not complete successfully");
          }

          // Extract transaction hash from the result steps
          const txHash =
            (result as any).steps?.find(
              (s: any) => s.txHash
            )?.txHash || "";

          updateEntry(pendingKey, {
            hash: txHash
              ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
              : "Confirmed",
            fullHash: txHash,
            status: "Confirmed",
          });
        })(),
        {
          loading:
            sendAsset === "DibsCoin"
              ? "Sending DIBS tokens..."
              : "Sending USDC...",
          success: "Transfer completed successfully!",
          error: (err) => {
            updateEntry(pendingKey, { status: "Failed" });
            const e = err as Error & {
              code?: number;
              cause?: { code?: number };
            };
            if (
              e?.code === 4001 ||
              e?.cause?.code === 4001 ||
              String(e?.message || "").includes("User rejected") ||
              String(e?.message || "").includes("rejected")
            ) {
              return "Transaction canceled by user";
            }
            return `Transfer failed: ${(err as Error).message.slice(0, 80)}`;
          },
        }
      );

      handleClose();
    } catch {
      updateEntry(pendingKey, { status: "Failed" });
    } finally {
      setIsSending(false);
    }
  }, [
    isValidSend,
    userAddress,
    activeWallet,
    sendAsset,
    sendRecipient,
    sendAmount,
    gasBalanceNum,
    dibsBalanceNum,
    addPendingEntry,
    updateEntry,
    handleClose,
  ]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      {/* Modal card */}
      <div className="tooltip-card relative w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
            Send Assets
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Asset Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
              Select Asset
            </label>
            <select
              value={sendAsset}
              onChange={(e) =>
                setSendAsset(e.target.value as "USDC Gas" | "DibsCoin")
              }
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-950 dark:text-slate-50 outline-none focus:border-primary/50 transition-colors"
            >
              <option value="USDC Gas">USDC Gas</option>
              <option value="DibsCoin">DibsCoin (DIBS)</option>
            </select>
          </div>

          {/* Recipient Address */}
          <div>
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
              Recipient Wallet Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={sendRecipient}
              onChange={(e) => setSendRecipient(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Amount
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSendFiftyPercent}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                >
                  50%
                </button>
                <button
                  onClick={handleSendMax}
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
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
              />
              <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                {sendAsset === "USDC Gas" ? "USDC" : "DIBS"}
              </span>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleSendConfirm}
            disabled={!isValidSend || isSending}
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
              isValidSend && !isSending
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                : "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
            }`}
          >
            <Send className="w-4 h-4" />
            Confirm Transfer
          </button>

          {/* Cancel */}
          <button
            onClick={handleClose}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
