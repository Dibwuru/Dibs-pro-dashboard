"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { createPublicClient, http, formatEther } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Menu, X, Coins, ArrowLeftRight, ChartBar, Fuel, ExternalLink, Sun, Moon } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gasBalance, setGasBalance] = useState<string>("--");

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

  if (!mounted) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 dark:border-slate-800 glass-sm rounded-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
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

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
          </div>

          {/* Desktop Right Side Actions */}
          <div className="hidden md:flex items-center gap-3">
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

            {/* Privy Auth Button */}
            <button
              onClick={() => (authenticated ? logout() : login())}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 hover:scale-105 transition-all flex-shrink-0"
            >
              {authenticated && user?.email?.address
                ? user.email.address.length > 18
                  ? `${user.email.address.slice(0, 15)}...`
                  : user.email.address
                : "Sign In with Email"}
            </button>

            {/* Wallet Connection */}
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-success/20 border border-success/25">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                  <span className="text-sm font-medium text-success tracking-wide">
                    {wagmiAddress ? formatAddress(wagmiAddress) : "Connected"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/20 border border-success/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                  <span className="text-xs font-medium text-success tracking-wide">
                    Arc Testnet
                  </span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-500 hover:text-error hover:bg-error/5 transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (connectors[0]) connect({ connector: connectors[0] });
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold btn-gradient text-white shadow-lg shadow-primary/20 flex-shrink-0"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Right Side */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Gas Pill */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-600/10 border border-amber-500/20 dark:bg-amber-400/10 dark:border-amber-400/20 flex-shrink-0">
              <Fuel className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Gas: {gasBalance} USDC
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
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

            {/* Mobile: Theme Toggle */}
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

            {/* Mobile: Privy Auth */}
            <button
              onClick={() => {
                authenticated ? logout() : login();
                setMobileOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all"
            >
              {authenticated && user?.email?.address
                ? user.email.address
                : "Sign In with Email"}
            </button>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              {isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium text-success tracking-wide">
                      {wagmiAddress ? formatAddress(wagmiAddress) : "Connected"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      disconnect();
                      setMobileOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-lg text-sm font-medium text-error hover:bg-error/5 transition-all text-left"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (connectors[0]) connect({ connector: connectors[0] });
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-semibold btn-gradient text-white"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
