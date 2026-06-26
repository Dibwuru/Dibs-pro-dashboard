// -----------------------------------------------------------------------------
// src/app/docs/page.tsx
//
// ARCTOR Terminal — System Architecture & User Guide
//
// This route is intentionally a 100% PASSIVE, STATIC, text-driven container:
//   • It does NOT import @privy-io/react-auth, wagmi hooks, or any component
//     that opens an active wallet connection.
//   • It does NOT touch localStorage, sessionStorage, window.ethereum, or any
//     wallet-context variables.
//   • It is a server component (no "use client" directive) so it inlines
//     flexibly with the Next.js app-router metadata API and contributes
//     zero JS to the runtime bundle.
//
// Render happens entirely off `DOCS_CONTENT` from src/constants/docsContent
// with a discriminated-union renderer (renderDocPart) — adding or re-ordering
// a section in the data file changes the rendered output automatically.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import {
  DOCS_CONTENT,
  DOCS_HERO_TITLE,
  DOCS_SUBTITLE,
  type CalloutSeverity,
  type DocPart,
  type DocSection,
} from "@/constants/docsContent";

export const metadata: Metadata = {
  title: "Documentation & FAQ — ARCTOR Terminal",
  description:
    "A complete walkthrough of the ARCTOR Terminal: Arc Testnet protocol, wallet topologies, token ledger, AMM swap mechanics, and platform FAQ.",
};

// =========================================================================
// Renderer — discriminated by DocPart["type"]. Returning a JSX node tree
// keyed off the array index keeps React's reconciler stable on re-render.
// =========================================================================

function renderDocPart(part: DocPart, idx: number) {
  switch (part.type) {
    case "paragraph":
      return (
        <p
          key={`p-${idx}`}
          className="text-base sm:text-[17px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {part.text}
        </p>
      );

    case "subheading":
      return (
        <h3
          key={`h-${idx}`}
          className="mt-10 mb-3 text-xl sm:text-2xl font-bold text-slate-950 dark:text-slate-50 tracking-tight"
        >
          {part.text}
        </h3>
      );

    case "table": {
      const monoColumns = new Set(part.columns.length === 3 ? [1] : []);
      return (
        <div
          key={`t-${idx}`}
          className="my-6 -mx-2 sm:mx-0 overflow-x-auto rounded-xl border border-slate-200 dark:border-amber-500/15 bg-white/85 dark:bg-[#0C1420]/80 backdrop-blur-md shadow-sm shadow-slate-900/5 dark:shadow-black/30"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200 dark:border-slate-800">
                {part.columns.map((col, ci) => (
                  <th
                    key={ci}
                    className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {part.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.04] transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`py-3.5 px-4 align-top text-slate-700 dark:text-slate-200 leading-relaxed ${
                        monoColumns.has(ci)
                          ? "font-mono text-[12px] break-all"
                          : "text-sm"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "unordered-list":
      return (
        <ul
          key={`u-${idx}`}
          className="my-4 space-y-2.5 pl-1 marker:text-amber-500/80 list-disc list-outside ml-6"
        >
          {part.items.map((item, i) => (
            <li
              key={i}
              className="text-base sm:text-[17px] leading-relaxed text-slate-700 dark:text-slate-300 pl-1"
            >
              {item}
            </li>
          ))}
        </ul>
      );

    case "ordered-list":
      return (
        <ol
          key={`o-${idx}`}
          className="my-4 space-y-2.5 pl-1 list-decimal list-outside ml-6 marker:font-bold marker:text-amber-500"
        >
          {part.items.map((item, i) => (
            <li
              key={i}
              className="text-base sm:text-[17px] leading-relaxed text-slate-700 dark:text-slate-300 pl-1"
            >
              {item}
            </li>
          ))}
        </ol>
      );

    case "callout": {
      const palette = getCalloutPalette(part.severity);
      return (
        <div
          key={`c-${idx}`}
          className={`my-6 rounded-xl border ${palette.border} ${palette.bg} px-5 py-4 shadow-sm shadow-amber-500/5`}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${palette.iconBg} ${palette.iconText} text-base font-bold`}
            >
              {palette.glyph}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-bold uppercase tracking-wider ${palette.titleText}`}
              >
                {part.title}
              </p>
              <p className={`mt-1.5 text-sm sm:text-base leading-relaxed ${palette.bodyText}`}>
                {part.text}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }
}

// Helper: map severity → Tailwind classes for callout bubbles.
function getCalloutPalette(severity: CalloutSeverity) {
  switch (severity) {
    case "warning":
      return {
        border: "border-amber-500/30",
        bg: "bg-amber-500/[0.06] dark:bg-amber-500/[0.05]",
        iconBg: "bg-amber-500/15",
        iconText: "text-amber-600 dark:text-amber-400",
        titleText: "text-amber-600 dark:text-amber-400",
        bodyText: "text-slate-700 dark:text-slate-300",
        glyph: "!",
      };
    case "tip":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.05]",
        iconBg: "bg-emerald-500/15",
        iconText: "text-emerald-600 dark:text-emerald-400",
        titleText: "text-emerald-600 dark:text-emerald-400",
        bodyText: "text-slate-700 dark:text-slate-300",
        glyph: "★",
      };
    case "success":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.07]",
        iconBg: "bg-emerald-500/20",
        iconText: "text-emerald-600 dark:text-emerald-400",
        titleText: "text-emerald-600 dark:text-emerald-400",
        bodyText: "text-slate-700 dark:text-slate-300",
        glyph: "✓",
      };
    case "info":
    default:
      return {
        border: "border-sky-500/30",
        bg: "bg-sky-500/[0.06] dark:bg-sky-500/[0.05]",
        iconBg: "bg-sky-500/15",
        iconText: "text-sky-600 dark:text-sky-400",
        titleText: "text-sky-600 dark:text-sky-400",
        bodyText: "text-slate-700 dark:text-slate-300",
        glyph: "i",
      };
  }
}

// =========================================================================
// Tiny presentational helpers (kept inside the route to preserve the
// "completely isolated /docs" boundary — no shared components imported).
// =========================================================================

function DocsBackLink({ href }: { href: string }) {
  return (
    <div className="mb-6">
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-amber-500/20 text-slate-700 dark:text-slate-200 bg-white/85 dark:bg-[#0C1420]/80 hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/[0.06] transition-all shadow-sm"
      >
        <span aria-hidden>←</span>
        <span>Back to Dashboard</span>
      </Link>
    </div>
  );
}

function DocsHero() {
  return (
    <header className="relative">
      <div className="mb-6 w-16 h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 leading-tight">
        <span className="text-gradient">ARCTOR</span>{" "}
        <span className="text-slate-700 dark:text-slate-200">Terminal</span>
      </h1>
      <p className="mt-3 text-base sm:text-lg font-semibold text-amber-600 dark:text-amber-400">
        {DOCS_HERO_TITLE}
      </p>
      <p className="mt-5 max-w-3xl text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
        {DOCS_SUBTITLE}
      </p>

      {/* Quick metadata strip — passive informational banner only.
          No hooks, no wallet reads. Pure presentation of static values. */}
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <span aria-hidden>●</span> Arc Testnet
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
          Chain ID 5042002
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          Native Gas · USDC
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
          v1.0
        </span>
      </div>
    </header>
  );
}

function DocsTableOfContents({ sections }: { sections: DocSection[] }) {
  return (
    <nav
      aria-label="Table of contents"
      className="mt-10 rounded-2xl border border-slate-200 dark:border-amber-500/15 bg-white/85 dark:bg-[#0C1420]/80 backdrop-blur-md p-6 sm:p-7 shadow-sm shadow-slate-900/5 dark:shadow-black/30"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-4">
        Contents
      </p>
      <ul className="space-y-2">
        {sections.map((s) => (
          <li key={s.anchor}>
            <a
              href={`#${s.anchor}`}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-500/[0.08] hover:text-amber-700 dark:hover:text-amber-300 transition-all border border-transparent hover:border-amber-500/20"
            >
              <span className="text-lg flex-shrink-0 w-7 text-center" aria-hidden>
                {s.icon}
              </span>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums w-5 flex-shrink-0">
                {s.number}.
              </span>
              <span className="flex-1 min-w-0 truncate">{s.title}</span>
              <span
                aria-hidden
                className="ml-auto text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all"
              >
                →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// =========================================================================
// Page — full page composition.
// =========================================================================

export default function DocsPage() {
  return (
    <div className="bg-obsidian flex flex-col flex-1">
      <div className="relative w-full px-4 sm:px-6 lg:px-8 py-10 lg:py-14 max-w-6xl mx-auto">
        {/* Top: navigation back to dashboard */}
        <DocsBackLink href="/dashboard" />

        {/* Hero */}
        <DocsHero />

        {/* Table of contents */}
        <DocsTableOfContents sections={DOCS_CONTENT} />

        {/* Sections */}
        <div className="space-y-16 mt-16">
          {DOCS_CONTENT.map((section) => (
            <section
              key={section.anchor}
              id={section.anchor}
              className="scroll-mt-24"
            >
              <header className="mb-7">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/25 text-2xl"
                  >
                    {section.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Section {section.number}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight leading-tight">
                      {section.title}
                    </h2>
                  </div>
                </div>
                <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-400 max-w-3xl">
                  {section.intro}
                </p>
              </header>

              <div className="space-y-2 max-w-3xl">
                {section.parts.map((part, idx) => renderDocPart(part, idx))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 pt-10 border-t border-amber-500/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ready to put the protocol into action?
            </p>
            <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
              Return to the live dashboard and inspect the on-chain ledger.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-primary to-secondary text-black shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <span aria-hidden>←</span>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
