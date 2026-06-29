"use client";

import { useWallets } from "@privy-io/react-auth";
import { useChainId } from "wagmi";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// Isolated Option A: Network switching is implemented LOCALLY in this
// component to keep regression risk contained. We do NOT import or call
// switchToArcTestnet from @/vaultConfig — per guardrail, we must not
// re-trigger any global state machine. The chain ID constant is used
// only for the wrong-network guard (read-only), never for the switch
// call itself, which uses the EIP-1193 provider directly.
//
// The hex chain ID is computed dynamically from the decimal constant so
// the wallet_switchEthereumChain call can never drift from the canonical
// Arc Testnet (5042002). NOTE: do not hardcode the hex — the wrong value
// (e.g. "0x4ce946") decodes to a completely different chain and the
// wallet would silently switch to the wrong network.
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_TESTNET_CHAIN_HEX = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;
const ARC_RPC_URL = "https://arc-testnet.drpc.org";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

export function NetworkGuard() {
  const { wallets } = useWallets();
  const wagmiChainId = useChainId();
  const [switching, setSwitching] = useState(false);

  const activeWallet = wallets[0];
  const activeChainId = activeWallet
    ? Number(activeWallet.chainId.replace("eip155:", ""))
    : null;

  // Validate against the canonical Arc Testnet numeric Chain ID (5042002).
  // Cross-check with wagmiChainId as a defensive guard so the banner appears
  // if either the active wallet's reported chainId OR the wagmi-reported
  // chain is on the wrong network — covers lag between Privy's internal
  // chain cache and wagmi's RPC-backed chainId after a fresh connect/switch.
  const isWrongNetwork =
    !!activeWallet &&
    activeChainId !== null &&
    activeChainId !== ARC_TESTNET_CHAIN_ID &&
    wagmiChainId !== ARC_TESTNET_CHAIN_ID;

  /**
   * LOCAL network switcher — never delegates to a global helper. Resolves
   * the raw EIP-3326 / EIP-4902 provider from the active wallet and calls
   * wallet_switchEthereumChain directly. On EIP-4902 (chain not yet added),
   * transparently falls back to wallet_addEthereumChain and retries.
   *
   * This is intentionally implemented inside this banner so we don't touch
   * the global auth/state pipeline (per the zero-touch regression policy).
   */
  const handleSwitch = useCallback(async () => {
    if (!activeWallet || switching) return;
    setSwitching(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      if (!provider || typeof provider.request !== "function") {
        throw new Error("No EIP-1193 provider available on the active wallet");
      }
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ARC_TESTNET_CHAIN_HEX }],
        });
      } catch (switchError: any) {
        // EIP-4902: wallet doesn't have the chain registered yet. Add it
        // via wallet_addEthereumChain and retry the switch.
        const code = switchError?.code ?? switchError?.cause?.code;
        const isUnrecognizedChain =
          code === 4902 ||
          String(switchError?.message || "").includes("Unrecognized chain") ||
          String(switchError?.message || "").includes("Try adding the chain");
        if (isUnrecognizedChain) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ARC_TESTNET_CHAIN_HEX,
                chainName: "Arc Testnet",
                nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
                rpcUrls: [ARC_RPC_URL],
                blockExplorerUrls: [ARC_EXPLORER_URL],
              },
            ],
          });
          // Retry the switch — most wallets resolve immediately after add.
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ARC_TESTNET_CHAIN_HEX }],
          });
        } else {
          throw switchError;
        }
      }
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code;
      const msg =
        code === 4001 || String(err?.message || "").includes("rejected")
          ? "Network switch was rejected"
          : "Failed to switch network — try manually in your wallet";
      toast.error(msg);
    } finally {
      setSwitching(false);
    }
  }, [activeWallet, switching]);

  if (!isWrongNetwork) return null;

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={switching}
      aria-label="Switch wallet to Arc Testnet (Chain ID 5042002)"
      className="sticky top-16 z-40 w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md hover:bg-amber-500/20 active:bg-amber-500/25 disabled:opacity-60 transition-colors"
    >
      <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200/90 font-medium">
        ⚠️ Wrong Network. Please switch to Arc Testnet to use DibsCoin.
      </p>
      <span
        aria-hidden="true"
        className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black pointer-events-none"
      >
        {switching ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Switching...
          </>
        ) : (
          "Switch to Arc Testnet"
        )}
      </span>
    </button>
  );
}
