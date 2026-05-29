"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Menu, X, Coins, ArrowLeftRight, ChartBar, Fuel, ExternalLink, Sun, Moon, LogOut, Copy, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";

const navLinks = [
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/stake", label: "Stake", icon: Coins },
  { href: "/dashboard", label: "Dashboard", icon: ChartBar },
];

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export function Navbar() {
  const pathname = usePathname();
  const { address: wagmiAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { theme, setTheme } = useTheme();
  const { login, authenticated, logout, user } = usePrivy();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gasBalance, setGasBalance] = useState<string>("--");
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  const activeAddress = wagmiAddress || user?.wallet?.address;

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

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // --- Identity capsule helpers ---
  const emailHandle =
    user?.email?.address || user?.google?.email || "Authenticated User";
  const embeddedWalletAddress = user?.wallet?.address || "";
  const truncatedEmbeddedAddress = embeddedWalletAddress
    ? `${embeddedWalletAddress.slice(0, 6)}...${embeddedWalletAddress.slice(-4)}`
    : "";

  const handleCopyAddress = useCallback(async () => {
    if (!embeddedWalletAddress) return;
    try {
      await navigator.clipboard.writeText(embeddedWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in insecure contexts
    }
  }, [embeddedWalletAddress]);

  if (!mounted) return null;

  return (
    <>
      {/* Drawer Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}

        />
      )}

      {/* Left Hamburger Menu Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#121826] shadow-xl z-50 border-r border-slate-200/80 dark:border-slate-800 p-6 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header with Close Button */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 font-bold text-lg tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Coins className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-gradient">ARCTOR</span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1 mb-6">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Drawer Auth & Wallet Actions */}
        <div className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
          {/* Privy Auth — Drawer */}
          {authenticated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50/30 dark:bg-amber-950/20 border border-amber-500/20">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {emailHandle.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
                    {emailHandle}
                  </p>
                  {embeddedWalletAddress && (
                    <button
                      onClick={handleCopyAddress}
                      className="text-[10px] font-mono text-amber-500/80 dark:text-amber-400/80 hover:text-amber-600 dark:hover:text-amber-300 transition-colors mt-0.5"
                    >
                      {copied ? "Copied!" : truncatedEmbeddedAddress}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-error hover:bg-error/5 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                login();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all"
            >
              Sign In with Email
            </button>
          )}

          {/* Wallet Connect / Disconnect */}
          {isConnected ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                <span className="text-sm font-medium text-success tracking-wide">
                  {wagmiAddress ? formatAddress(wagmiAddress) : "Connected"}
                </span>
              </div>
              <button
                onClick={() => {
                  disconnect();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-error hover:bg-error/5 transition-all text-left"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (connectors[0]) connect({ connector: connectors[0] });
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-semibold btn-gradient text-white"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}

          {/* Theme Toggle in Drawer */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            Toggle Theme
          </button>
        </div>

        {/* Drawer Footer */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Arc Testnet • Chain 5042002
            </p>
          </div>
        </div>
      </div>

      {/* Main Navbar — Sticky Glass Overlay */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#090D16]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Hamburger + Logo */}
            <div className="flex items-center gap-3">
              {/* Hamburger Button */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
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
                  <div className="bg-slate-900 dark:bg-[#121826] border border-slate-700 dark:border-slate-800 rounded-lg p-3 shadow-xl">
                    <p className="text-xs text-slate-300 dark:text-slate-400 mb-2">
                      Need testnet gas tokens?
                    </p>
                    <a
                      href="https://faucet.arc.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 dark:text-amber-400 hover:text-amber-400 dark:hover:text-amber-300 transition-colors"
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
                className="p-2 rounded-lg bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-amber-400 hover:scale-105 transition-all flex-shrink-0"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Privy Identity Capsule / Auth Button */}
              {authenticated ? (
                <div className="hidden sm:flex items-center gap-1.5">
                  {/* Dual-segmented gold glassmorphic identity capsule */}
                  <div className="flex items-stretch rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden shadow-sm shadow-amber-500/5">
                    {/* Left segment: Email handle */}
                    <span className="inline-flex items-center px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 border-r border-amber-500/20 max-w-[180px] truncate">
                      {emailHandle}
                    </span>
                    {/* Right segment: Wallet address with copy */}
                    {embeddedWalletAddress ? (
                      <button
                        onClick={handleCopyAddress}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors group"
                        title="Click to copy wallet address"
                      >
                        <span>{copied ? "Copied!" : truncatedEmbeddedAddress}</span>
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
                  {/* Logout micro-toggle */}
                  <button
                    onClick={() => logout()}
                    className="p-2 rounded-lg text-amber-500/70 hover:text-error hover:bg-error/5 transition-all"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => login()}
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:scale-105 transition-all flex-shrink-0"
                >
                  Sign In with Email
                </button>
              )}

              {/* Wallet Connection */}
              {isConnected ? (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-success/20 border border-success/25">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium text-success tracking-wide">
                      {wagmiAddress ? formatAddress(wagmiAddress) : "Connected"}
                    </span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/20 border border-success/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <span className="text-xs font-medium text-success tracking-wide">
                      Arc Testnet
                    </span>
                  </div>
                  <button
                    onClick={() => disconnect()}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-error hover:bg-error/5 transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (connectors[0]) connect({ connector: connectors[0] });
                  }}
                  className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-gradient text-white shadow-lg shadow-primary/20 flex-shrink-0"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
