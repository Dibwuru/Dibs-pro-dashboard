"use client";

import { usePrivy, useConnectWallet } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import Link from "next/link";
import { Menu, Coins, Fuel, ExternalLink, Sun, Moon, LogOut, Copy, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useSidebar } from "@/components/SidebarContext";

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { login, authenticated, logout, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { openMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [gasBalance, setGasBalance] = useState<string>("--");
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  // Address derived strictly from authenticated Privy user wallet
  const activeAddress = (user?.wallet?.address) as `0x${string}` | undefined;
  const isWalletActive = authenticated && !!user?.wallet?.address;

  // Nuclear disconnect: wipe Privy session + clear stale caches + full reload
  const handleDisconnect = useCallback(async () => {
    try {
      await logout();
    } catch {
      // logout may be no-op if not authenticated
    }
    localStorage.clear();
    window.location.reload();
  }, [logout]);

  const fetchGasBalance = useCallback(async () => {
    if (!activeAddress) {
      setGasBalance("--");
      return;
    }
    try {
      const balance = await publicClient.getBalance({
        address: activeAddress as `0x${string}`,
      });
      const formatted = formatEther(balance);
      const num = parseFloat(formatted);
      setGasBalance(num < 0.0001 ? "<0.0001" : num.toFixed(4));
    } catch {
      setGasBalance("--");
    }
  }, [activeAddress]);

  useEffect(() => {
    fetchGasBalance();
    const interval = setInterval(fetchGasBalance, 8000);
    return () => clearInterval(interval);
  }, [fetchGasBalance]);

  // --- Identity capsule helpers ---
  const emailHandle =
    user?.email?.address || user?.google?.email || "Authenticated User";
  const embeddedWalletAddress = user?.wallet?.address || "";
  const displayedAddress = embeddedWalletAddress;
  const truncatedAddress = displayedAddress
    ? `${displayedAddress.slice(0, 6)}...${displayedAddress.slice(-4)}`
    : "";

  const handleCopyAddress = useCallback(async () => {
    if (!displayedAddress) return;
    try {
      await navigator.clipboard.writeText(displayedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in insecure contexts
    }
  }, [displayedAddress]);

  if (!mounted) return null;

  return (
    /* Main Navbar — Sticky Glass Overlay */
    <nav className="sticky top-0 z-50 w-full bg-white/85 dark:bg-[#050B14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-amber-500/10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Hamburger + Logo */}
            <div className="flex items-center gap-3">
              {/* Hamburger Button — opens mobile sidebar drawer */}
              <button
                onClick={openMobile}
                className="p-2 rounded-lg lg:hidden text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Logo */}
              <Link
                href="/"
                className="flex items-center gap-2.5 font-bold text-lg tracking-tight flex-shrink-0"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Coins className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-gradient hidden sm:inline">ARCTOR Terminal</span>
                <span className="text-gradient sm:hidden">ARCTOR</span>
              </Link>
            </div>

            {/* Right Side Actions: [Gas Pill] → [Theme Toggle] → [Sign In] → [Wallet] → [Arc Badge] → [Disconnect] */}
            <div className="flex items-center gap-3">
              {/* USDC Gas Status Pill */}
              <div className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600/10 border border-amber-500/20 dark:bg-amber-400/10 dark:border-amber-400/20">
                <Fuel className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 tracking-wide">
                  Gas: {gasBalance} USDC
                </span>
                {/* Tooltip */}
                <div className="absolute top-full mt-2 right-0 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="tooltip-card p-3">
                    <p className="text-xs mb-2">
                      Need testnet gas tokens?
                    </p>
                    <a
                      href="https://faucet.arc.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Get Faucet Gas
                    </a>
                  </div>
                </div>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="p-2 theme-btn hover:scale-105 transition-all flex-shrink-0"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Privy Identity Capsule / Auth Button */}
              {isWalletActive ? (
                <div className="hidden sm:flex items-center gap-1.5">
                  {/* Dual-segmented gold glassmorphic identity capsule */}
                  <div className="flex items-stretch rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden shadow-sm shadow-amber-500/5">
                    {/* Left segment: Email handle */}
                    <span className="inline-flex items-center px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 border-r border-amber-500/20 max-w-[180px] truncate">
                      {emailHandle}
                    </span>
                    {/* Right segment: Wallet address with copy */}
                    {displayedAddress ? (
                      <button
                        onClick={handleCopyAddress}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors group"
                        title="Click to copy wallet address"
                      >
                        <span>{copied ? "Copied!" : truncatedAddress}</span>
                        {copied ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-3 py-2 text-xs font-mono text-amber-500/50 dark:text-amber-400/50 italic">
                        No wallet
                      </span>
                    )}
                  </div>
                  {/* Unified disconnect micro-toggle */}
                  <button
                    onClick={handleDisconnect}
                    className="p-2 rounded-lg text-amber-500/70 hover:text-error hover:bg-error/5 transition-all"
                    title="Disconnect"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => connectWallet()}
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:scale-105 active:scale-[0.97] transition-all flex-shrink-0"
                  >
                    Connect Wallet
                  </button>
                  <button
                    onClick={() => login()}
                    className="hidden sm:inline-flex px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:scale-105 transition-all flex-shrink-0"
                  >
                    Sign In with Email
                  </button>
                </>
              )}


            </div>
          </div>
        </div>
      </nav>
  );
}
