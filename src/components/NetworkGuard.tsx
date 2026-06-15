"use client";

import { useWallets } from "@privy-io/react-auth";
import { useChainId } from "wagmi";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ARC_TESTNET_CHAIN_ID,
  switchToArcTestnet,
} from "@/vaultConfig";

export function NetworkGuard() {
  const { wallets } = useWallets();
  const wagmiChainId = useChainId();
  const [switching, setSwitching] = useState(false);

  const activeWallet = wallets[0];
  const activeChainId = activeWallet
    ? Number(activeWallet.chainId.replace("eip155:", ""))
    : null;

  const isWrongNetwork =
    !!activeWallet &&
    activeChainId !== null &&
    activeChainId !== ARC_TESTNET_CHAIN_ID &&
    wagmiChainId !== ARC_TESTNET_CHAIN_ID;

  const handleSwitch = useCallback(async () => {
    if (!activeWallet) return;
    setSwitching(true);
    try {
      await switchToArcTestnet(activeWallet);
    } catch (err: any) {
      const msg =
        err?.code === 4001 || String(err?.message || "").includes("rejected")
          ? "Network switch was rejected"
          : "Failed to switch network — try manually in your wallet";
      toast.error(msg);
    } finally {
      setSwitching(false);
    }
  }, [activeWallet]);

  if (!isWrongNetwork) return null;

  return (
    <div className="sticky top-16 z-40 flex items-center justify-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
      <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200/90">
        ⚠️ Wrong Network. Please switch to Arc Testnet to use DibsCoin.
      </p>
      <button
        onClick={handleSwitch}
        disabled={switching}
        className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-60 transition-all"
      >
        {switching ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Switching...
          </>
        ) : (
          "Switch"
        )}
      </button>
    </div>
  );
}
