"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Coins,
  ChartBar,
  X,
  LogOut,
  Copy,
  Check,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useSidebar } from "@/components/SidebarContext";

const STORAGE_KEY = "arctor_profile";

const navLinks = [
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/stake", label: "Stake", icon: Coins },
  { href: "/dashboard", label: "Dashboard", icon: ChartBar },
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
  const { authenticated, user, logout, login } = usePrivy();
  const { wallets } = useWallets();
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

  // External wallet (MetaMask etc.) takes priority; falls back to embedded wallet
  const externalWalletAddress = wallets.length > 0 ? (wallets[0].address as string) : null;
  const isWalletActive = !!externalWalletAddress || (authenticated && !!user?.wallet?.address);

  // Unified disconnect: logout Privy session AND disconnect the external wallet
  const handleDisconnect = useCallback(async () => {
    try {
      if (wallets.length > 0) {
        await wallets[0].disconnect();
      }
    } catch {
      // wallet disconnect may throw if already disconnected
    }
    try {
      await logout();
    } catch {
      // logout may be no-op if not authenticated
    }
  }, [wallets, logout]);

  const emailHandle =
    user?.email?.address || user?.google?.email || "Authenticated User";
  const embeddedWalletAddress = user?.wallet?.address || "";
  const displayedAddress = externalWalletAddress || embeddedWalletAddress;
  const truncatedWallet =
    displayedAddress.slice(0, 6) + "..." + displayedAddress.slice(-4);
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

      {/* Bottom area: Profile + Theme + Footer */}
      <div className="px-3 pb-5 space-y-3">
        {/* Privy Identity Capsule */}
        {authenticated ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04] backdrop-blur-md overflow-hidden">
            {/* Avatar + Info Row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={openProfileEditor}
                className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 border-2 border-amber-400/50 dark:border-amber-500/40 flex items-center justify-center flex-shrink-0 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-all group"
                title="Edit profile"
              >
                <span className="text-base font-bold text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                  {avatarLetter}
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300/90 truncate">
                  {displayEmail}
                </p>
                {displayedAddress && (
                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center gap-1 text-[10px] font-mono text-amber-600/70 dark:text-amber-500/70 hover:text-amber-700 dark:hover:text-amber-400 transition-colors mt-0.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-success" />
                        Copied!
                      </>
                    ) : (
                      <>
                        {truncatedWallet}
                        <Copy className="w-2.5 h-2.5 opacity-60" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all border-t border-amber-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        ) : isWalletActive ? (
          /* External wallet connected (MetaMask etc.) — show truncated address + disconnect */
          <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04] backdrop-blur-md overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 border-2 border-amber-400/50 dark:border-amber-500/40 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {truncatedWallet.slice(2, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300/90">
                  Connected
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1 text-[10px] font-mono text-amber-600/70 dark:text-amber-500/70 hover:text-amber-700 dark:hover:text-amber-400 transition-colors mt-0.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      {truncatedWallet}
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all border-t border-amber-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-2">
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
