import Link from "next/link";
import { Coins, ExternalLink, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800 glass-sm rounded-none mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gradient">
              ARCTOR Terminal
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/swap"
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-50 transition-colors"
            >
              Swap
            </Link>
            <Link
              href="/stake"
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-50 transition-colors"
            >
              Stake
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-50 transition-colors"
            >
              Dashboard
            </Link>
          </div>

          {/* Socials */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} ARCTOR Terminal. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
