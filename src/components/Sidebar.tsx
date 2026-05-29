"use client";

import { usePrivy } from "@privy-io/react-auth";
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
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

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

export function Sidebar() {
  const pathname = usePathname();
  const { authenticated, user, logout, login } = usePrivy();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Profile editor modal state
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [customBio, setCustomBio] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");
  // Live display name used in the sidebar capsule (updated on save)
  const [activeDisplayName, setActiveDisplayName] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const emailHandle =
    user?.email?.address || user?.google?.email || "Authenticated User";
  const embeddedWalletAddress = user?.wallet?.address || "";
  const truncatedWallet =
    embeddedWalletAddress.slice(0, 6) + "..." + embeddedWalletAddress.slice(-4);
  const displayEmail = activeDisplayName || truncateEmail(emailHandle);
  const avatarLetter = (activeDisplayName || emailHandle).charAt(0).toUpperCase();

  const handleCopyAddress = useCallback(async () => {
    if (!embeddedWalletAddress) return;
    try {
      await navigator.clipboard.writeText(embeddedWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable
    }
  }, [embeddedWalletAddress]);

  const handleSaveProfile = useCallback(() => {
    if (displayName.trim()) {
      setActiveDisplayName(displayName.trim());
    }
    toast.success("Identity settings updated successfully!");
    setIsProfileEditorOpen(false);
  }, [displayName]);

  if (!mounted) return null;

  return (
    <>
      {/* Persistent Left Sidebar — visible on lg+ */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 flex-shrink-0 border-r border-amber-500/20 bg-white/80 dark:bg-[#0A0F1A]/90 backdrop-blur-xl z-40">
        {/* Top: Logo + Brand */}
        <div className="px-5 pt-6 pb-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Coins className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-gradient">ARCTOR</span>
          </Link>
        </div>

        {/* Middle: Navigation Links */}
        <nav className="flex-1 px-3 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
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

        {/* Bottom: Profile Identity Capsule */}
        <div className="px-3 pb-5">
          {authenticated ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04] backdrop-blur-md overflow-hidden">
              {/* Avatar + Info Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Alphabet Avatar Circle */}
                <button
                  onClick={() => setIsProfileEditorOpen(true)}
                  className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 border-2 border-amber-400/50 dark:border-amber-500/40 flex items-center justify-center flex-shrink-0 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/20 transition-all group"
                  title="Edit profile"
                >
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                    {avatarLetter}
                  </span>
                </button>

                {/* Email + Wallet Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300/90 truncate">
                    {displayEmail}
                  </p>
                  {embeddedWalletAddress && (
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

              {/* Sign Out */}
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all border-t border-amber-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => login()}
              className="w-full px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04] backdrop-blur-md text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-500/[0.08] hover:border-amber-500/30 transition-all"
            >
              Sign In with Email
            </button>
          )}
        </div>
      </aside>

      {/* ===== PROFILE EDITOR MODAL ===== */}
      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsProfileEditorOpen(false)}
          />

          {/* Modal Sheet */}
          <div className="relative w-full max-w-md bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-amber-500/20 shadow-2xl shadow-black/20 dark:shadow-black/40 p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Profile Settings
              </h3>
              <button
                onClick={() => setIsProfileEditorOpen(false)}
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
                onClick={() => setIsProfileEditorOpen(false)}
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
