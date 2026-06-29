"use client";

import { usePrivy, useConnectWallet, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Coins,
  ChartBar,
  BookOpen,
  Droplet,
  X,
  LogOut,
  Copy,
  Check,
  Settings,
  Sun,
  Moon,
  ExternalLink,
  Cpu,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useSidebar } from "@/components/SidebarContext";
import { formatAddress } from "@/lib/format";


const STORAGE_KEY = "arctor_profile";

const navLinks = [
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/stake", label: "Stake", icon: Coins },
  { href: "/dashboard", label: "Dashboard", icon: ChartBar },
  { href: "/agent", label: "Agent", icon: Cpu },
  { href: "/docs", label: "Documentation", icon: BookOpen },
];

function truncateEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return email;
  const local = email.slice(0, atIndex);
  if (local.length <= 8) return email;
  return `${local.slice(0, 4)}...${local.slice(-4)}`;
}

interface ProfileData {
  displayName: string;
  customBio: string;
  pfpUrl: string;
}

function loadProfile(): ProfileData {
  if (typeof window === "undefined") return { displayName: "", customBio: "", pfpUrl: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { displayName: "", customBio: "", pfpUrl: "" };
    return JSON.parse(raw) as ProfileData;
  } catch {
    return { displayName: "", customBio: "", pfpUrl: "" };
  }
}

function saveProfile(data: ProfileData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const { authenticated, ready, user, logout, login } = usePrivy();
  const { wallets: sidebarWallets } = useWallets();
  const { connectWallet } = useConnectWallet();

  const { theme, setTheme } = useTheme();
  const { isMobileOpen, closeMobile, isProfileEditorOpen, openProfileEditor, closeProfileEditor } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Profile editor modal state — seeded from localStorage (open/close via SidebarContext)
  const [displayName, setDisplayName] = useState("");
  const [customBio, setCustomBio] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");
  const [activeDisplayName, setActiveDisplayName] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = loadProfile();
    if (stored.displayName) {
      setDisplayName(stored.displayName);
      setActiveDisplayName(stored.displayName);
    }
    if (stored.customBio) setCustomBio(stored.customBio);
    if (stored.pfpUrl) setPfpUrl(stored.pfpUrl);
  }, []);

  // Unified active state: supports both Privy auth and external wallet connections
  const isUIActive = ready && (authenticated || (sidebarWallets && sidebarWallets.length > 0));

  // Privy-native disconnect: fire the wagmi disconnect hook on every
  // *external* wallet to clear wagmi session state, then call logout() to
  // invalidate HTTP-only auth cookies and tear down Privy's managed
  // embedded wallets (avoiding a double-teardown race on embedded ones).
  // The logout call is wrapped in a robust try/catch so a stray 400 from
  // Privy's session-clear endpoint never halts the flow — we always force
  // a complete storage purge and hard reload to guarantee a clean state.
  const handleDisconnect = useCallback(async () => {
    // Tear down external wagmi bindings first (allSettled = no throw on
    // individual wallet failures, so a partial disconnect never blocks us).
    const externalWallets = sidebarWallets.filter(
      (wallet) => wallet.walletClientType !== "privy"
    );
    await Promise.allSettled(
      externalWallets.map((wallet) => wallet.disconnect())
    );

    try {
      // logout() invalidates Privy auth cookies and finalises the session,
      // including the embedded-wallet store. Failure here (e.g. HTTP 400
      // from a stale session) is intentionally swallowed below.
      await logout();
    } catch (e) {
      console.warn("Handled Privy session clear error gracefully:", e);
    }
    // Force a complete state purge and hard reload so the user always lands
    // back on a clean UI, even if Privy's session-clear call partially failed.
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace(window.location.origin);
  }, [logout, sidebarWallets]);

  const activeAddress = (sidebarWallets[0]?.address as string) || user?.wallet?.address || "";
  const emailHandle =
    user?.email?.address || user?.google?.email || "Connected Wallet";
  const embeddedWalletAddress = user?.wallet?.address || "";
  const displayedAddress = activeAddress || embeddedWalletAddress;
  const truncatedWallet = formatAddress(displayedAddress);
  const displayEmail = activeDisplayName || truncateEmail(emailHandle);
  const avatarLetter = (activeDisplayName || emailHandle).charAt(0).toUpperCase();

  const handleCopyAddress = useCallback(async () => {
    if (!displayedAddress) return;
    try {
      await navigator.clipboard.writeText(displayedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable
    }
  }, [displayedAddress]);

  const handleSaveProfile = useCallback(() => {
    const name = displayName.trim();
    if (name) {
      setActiveDisplayName(name);
    }
    saveProfile({
      displayName: name,
      customBio: customBio.trim(),
      pfpUrl: pfpUrl.trim(),
    });
    toast.success("Identity settings updated successfully!");
    closeProfileEditor();
  }, [displayName, customBio, pfpUrl, closeProfileEditor]);

  // Close mobile drawer on navigation
  const handleNavClick = useCallback(() => {
    closeMobile();
  }, [closeMobile]);

  if (!mounted) return null;

  // --- Shared sidebar content (used by both desktop and mobile) ---
  const sidebarContent = (
    <>
      {/* Top: Logo + Brand */}
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          onClick={handleNavClick}
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Coins className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-gradient">ARCTOR</span>
        </Link>
      </div>

      {/* Middle: Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}

      </nav>

      {/* Circle Faucet — minimalist nav-link style, sits inline with primary menu */}
      <div className="px-3 pb-2">
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.06] transition-all"
        >
          <Droplet className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Circle Faucet</span>
          <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
        </a>
      </div>

      {/* Bottom area: Profile + Theme + Footer */}
      <div className="px-3 pb-5 space-y-1">
        {/* Privy Identity — slim inline nav-links (matches primary menu spacing) */}
        {isUIActive ? (
          <>
            {/* Profile trigger — compact avatar + email + copyable address, one nav-link row */}
            <div
              onClick={openProfileEditor}
              title="Edit profile"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/[0.06] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {avatarLetter}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {displayEmail}
                </p>
                {displayedAddress && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyAddress();
                    }}
                    className="flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <span className="truncate">{truncatedWallet}</span>
                        <Copy className="w-2.5 h-2.5 opacity-60 shrink-0" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Disconnect — slim nav-link row, no border-t or boxed wrapper */}
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/[0.05] dark:hover:bg-red-500/[0.05]"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="truncate">Disconnect</span>
            </button>
          </>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              onClick={() => connectWallet()}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.98] transition-all"
            >
              Connect Wallet
            </button>
            <button
              onClick={() => login()}
              className="w-full px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04] backdrop-blur-md text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/[0.08] hover:border-amber-500/30 transition-all"
            >
              Sign In with Email
            </button>
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
          Toggle Theme
        </button>

        {/* Arc Testnet Footer */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Arc Testnet • Chain 5042002
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ===== DESKTOP: Persistent Left Sidebar (lg+) ===== */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0 border-r border-amber-500/15 bg-white/85 dark:bg-[#060C16]/95 backdrop-blur-xl z-40">
        {sidebarContent}
      </aside>

      {/* ===== MOBILE: Slide-in Drawer (< lg) ===== */}
      {/* Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
          onClick={closeMobile}
        />
      )}

      {/* Drawer panel */}
      <div          className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#060C16] shadow-2xl z-[100] border-r border-amber-500/15 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Mobile close button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={closeMobile}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </div>

      {/* ===== PROFILE EDITOR MODAL ===== */}
      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeProfileEditor}
          />

          {/* Modal Sheet */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-amber-500/20 shadow-2xl shadow-black/20 dark:shadow-black/40 p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Profile Settings
              </h3>
              <button
                onClick={closeProfileEditor}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                  Display Name / Handle
                </label>
                <input
                  type="text"
                  placeholder="Enter your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Custom Bio */}
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                  Custom Bio Details
                </label>
                <textarea
                  placeholder="Tell us about yourself..."
                  rows={3}
                  value={customBio}
                  onChange={(e) => setCustomBio(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-amber-500/50 transition-colors resize-none"
                />
              </div>

              {/* PFP Image URL */}
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                  Drop Custom PFP Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={pfpUrl}
                  onChange={(e) => setPfpUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                className="w-full px-6 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] transition-all"
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Save Profile Settings
              </button>

              {/* Cancel */}
              <button
                onClick={closeProfileEditor}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
