"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Lock, User, ExternalLink } from "lucide-react";
import { useSidebar } from "@/components/SidebarContext";

type NavTab =
  | { href: string; label: string; icon: typeof Home; isAction?: undefined; isExternal?: boolean }
  | { label: string; icon: typeof User; isAction: true };

const tabs: NavTab[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/stake", label: "Stake", icon: Lock },
  { href: "https://faucet.circle.com/", label: "Faucet", icon: ExternalLink, isExternal: true },
  { label: "Profile", icon: User, isAction: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { openProfileEditor } = useSidebar();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden bg-[#0A0F1A]/90 dark:bg-[#0A0F1A]/90 backdrop-blur-xl border-t border-amber-500/20 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key="profile"
                onClick={openProfileEditor}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-amber-400 active:text-amber-300 transition-all duration-150 active:scale-90"
                aria-label="Open profile settings"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center hover:border-amber-500/40 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </button>
            );
          }

          if ("isExternal" in tab && tab.isExternal) {
            return (
              <a
                key="faucet"
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-white/70 transition-all duration-150 active:scale-90"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </a>
            );
          }

          const isActive =
            (tab.href === "/" && pathname === "/") ||
            (tab.href !== "/" && pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-90 ${
                isActive
                  ? "text-amber-400"
                  : "text-zinc-400 hover:text-white/70"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" : ""
                }`}
              />
              <span className="text-[10px] font-medium leading-none">
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
