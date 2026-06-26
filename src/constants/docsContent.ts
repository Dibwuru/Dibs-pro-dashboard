// -----------------------------------------------------------------------------
// src/constants/docsContent.ts
//
// Static, deterministic content module for the ARCTOR Terminal /docs route.
//
// This module is intentionally framework-agnostic:
//   • It exports a strongly-typed data structure (no React, no DOM, no hooks).
//   • It never imports Wagmi hooks, the Privy provider, or any wallet-context
//     state. The /docs route therefore stays 100% passive and can never
//     interfere with the global wallet connection lifecycle.
//   • It is meant to be consumed by the docs page's Tailwind renderer only.
//
// Render contract — every entry in DOCS_CONTENT has:
//   • `icon`       : emoji banner used in the section header.
//   • `number`     : ordinal shown next to the title.
//   • `anchor`     : URL-friendly fragment so deep-links behave well.
//   • `title`      : section heading text.
//   • `intro`      : short summary paragraph rendered above the parts grid.
//   • `parts`      : array of discriminated-union DocPart entries the page
//                    renders by `type`. Adding a new variant is a single-file
//                    change in the renderer.
//
// All copy strings here are production-grade and were harmonized against
// src/vaultConfig.ts (chain id, RPC, explorer, contract addresses) and the
// production UI strings in src/app/page.tsx / src/app/dashboard/page.tsx.
// -----------------------------------------------------------------------------

// --- DocPart union ---------------------------------------------------------

export type CalloutSeverity = "info" | "warning" | "tip" | "success";

export type DocPart =
  | { type: "paragraph"; text: string }
  | { type: "subheading"; text: string }
  | {
      type: "table";
      columns: string[];
      rows: string[][];
    }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | {
      type: "callout";
      severity: CalloutSeverity;
      title: string;
      text: string;
    };

export interface DocSection {
  icon: string;
  number: string;
  anchor: string;
  title: string;
  intro: string;
  parts: DocPart[];
}

// --- Page-level constants --------------------------------------------------

export const DOCS_TITLE =
  "ARCTOR Terminal — System Architecture & User Guide";

// Hero subheading rendered directly below the page title. Kept as its own
// constant (instead of slicing DOCS_TITLE) so future copy edits are safe.
export const DOCS_HERO_TITLE = "System Architecture & User Guide";

export const DOCS_SUBTITLE =
  "A professional knowledge layer that maps the Arc Testnet protocol, identity model, asset ledger, AMM swap mechanics, and platform FAQ behind the ARCTOR Terminal.";

// --- 1. Core Protocol Specifications ---------------------------------------

const Section1: DocSection = {
  icon: "🏗️",
  number: "1",
  anchor: "core-protocol-specifications",
  title: "Core Protocol Specifications",
  intro:
    "ARCTOR Terminal is the sovereign decentralized portal for the $DIBS ecosystem, deployed directly against the Arc Testnet. Every value below is the canonical source of truth — banner checks, RPC lookups, balance readers, and approval targets are all harmonised against this metadata table at startup.",
  parts: [
    {
      type: "paragraph",
      text: "The protocol runs as a single chain deployment. There is no multi-chain shim, no auxiliary rollup, and no off-chain oracle — the only network the terminal will ever transact against is the Arc Testnet. This guarantees that the \"Wrong Network\" banner, balance fetcher, and swap execution path always evaluate against the same numeric chain id.",
    },
    {
      type: "subheading",
      text: "Network Metadata",
    },
    {
      type: "table",
      columns: ["Field", "Canonical Value"],
      rows: [
        ["Network Name", "Arc Testnet"],
        ["Chain ID", "5042002"],
        [
          "Native Settlement Gas",
          "USDC (treated as the native currency for gas accounting)",
        ],
        [
          "RPC Endpoint",
          "https://arc-testnet.drpc.org",
        ],
        [
          "Explorer URL",
          "https://arc-testnet.drpc.org (block explorer / transaction view)",
        ],
        [
          "Numerical Safety Guard",
          "isWrongNetwork === true whenever activeChainId !== 5042002; placeholder chain variables are explicitly rejected.",
        ],
      ],
    },
    {
      type: "subheading",
      text: "Canonical Contract Addresses",
    },
    {
      type: "table",
      columns: ["Contract", "Address", "Role"],
      rows: [
        [
          "$DIBS Token (ERC-20, 18 decimals)",
          "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912",
          "Balance reads, transfer events, allowance approvals.",
        ],
        [
          "DibsSwapVault V2",
          "0xc45073b9de74c7f286c2545a618b703f31228cb6",
          "Holds the USDC ↔ DIBS liquidity pool and exposes the swap plus stake entrypoints used by the terminal UI.",
        ],
      ],
    },
    {
      type: "callout",
      severity: "info",
      title: "Address Safety Net",
      text: "If NEXT_PUBLIC_DIBS_ADDRESS or NEXT_PUBLIC_VAULT_ADDRESS environment variables are missing, malformed, or accidentally truncated (e.g. a 39-character hex string), the terminal falls back to the canonical addresses above at runtime and warns in the browser console. This guarantees that balanceOf / approve calls always point at the SAME on-chain contract.",
    },
  ],
};

// --- 2. Identity Resolution & Wallet Topology ------------------------------

const Section2: DocSection = {
  icon: "💳",
  number: "2",
  anchor: "identity-resolution-and-wallet-topology",
  title: "Identity Resolution & Wallet Topology",
  intro:
    "Identity in the ARCTOR Terminal is resolved through two non-overlapping wallet topologies. The terminal queries both during mount and treats whichever resolves first as the active signer. This section documents the difference between the two paths so the user can make an informed decision about custody and recovery.",
  parts: [
    {
      type: "paragraph",
      text: "Regardless of which topology resolves, the active signer is treated identically by the downstream pipeline — balance polling, swap execution, and staking all read from the same wallet object. The only differences are signing authority and recovery semantics, which are summarised below.",
    },
    {
      type: "subheading",
      text: "Non-Custodial Browser Extensions (Rabby, MetaMask, WalletConnect)",
    },
    {
      type: "paragraph",
      text: "Users that connect through a standard EIP-1193 browser extension (Rabby being the recommended choice on the Arc Testnet) keep full custody of their seed phrase and signing keys. The terminal never sees the seed phrase — it only receives a getEthereumProvider() handle used to dispatch writeContract calls and listen for events. This path is ideal for users who already manage their own keys and want zero server-side custody.",
    },
    {
      type: "unordered-list",
      items: [
        "Custody: user-controlled seed phrase stored in the extension.",
        "Identity proof: signed message + provider handle (no Privy session).",
        "Recovery: bounded to the user's 12 / 24-word recovery phrase.",
        "Switching wallets: switch the active account inside the extension — the terminal re-reads on the next route change.",
        "Recommended for: power users, multi-chain operators, and anyone that already owns their keys.",
      ],
    },
    {
      type: "subheading",
      text: "Privy Embedded Social Wallets (Google, Email)",
    },
    {
      type: "paragraph",
      text: "Users that prefer a social login flow are authenticated through Privy. On successful login, Privy provisions a non-custodial embedded wallet whose signing keys are sharded between the user's identity provider (Google, Twitter, or email OTP) and Privy's HSM enclave. The terminal receives a wallet object identical in shape to the extension topology, so downstream code is topology-agnostic.",
    },
    {
      type: "ordered-list",
      items: [
        "User clicks the Sign In with Email or Sign In with Email button in the sidebar / login card.",
        "Privy redirects to an OAuth provider or email OTP challenge, and returns with an authenticated session cookie.",
        "Privy issues an embedded wallet at the EIP-1193 layer; the terminal polls getEthereumProvider() on it exactly as it would for an extension.",
        "On logout, the local session cookie is cleared and the embedded wallet store is torn down. Any USDC balance held by that embedded address remains on-chain; the user can re-derive the same address by signing in via the same OAuth identity.",
      ],
    },
    {
      type: "callout",
      severity: "tip",
      title: "Logout Resilience",
      text: "A stray HTTP 400 from Privy's session-clear endpoint no longer halts the disconnect flow — it is swallowed inside a try/catch wrapper, after which the terminal forces a complete storage purge (localStorage + sessionStorage) and hard-reloads to the origin. The user always returns to a clean state.",
    },
  ],
};

// --- 3. Token Asset Architecture & Ledger Balances -------------------------

const Section3: DocSection = {
  icon: "🪙",
  number: "3",
  anchor: "token-asset-architecture-and-ledger-balances",
  title: "Token Asset Architecture & Ledger Balances",
  intro:
    "Two distinct asset accounting rules govern the ARCTOR Terminal ledger: USDC is treated as the native settlement gas, and $DIBS is a fully-fledged ERC-20 token with 18 decimal places. Both are read through the same viem public-client pipeline but use different read entrypoints — getting that distinction right is what stops balances from collapsing to zero.",
  parts: [
    {
      type: "subheading",
      text: "Native Settlement Gas (USDC)",
    },
    {
      type: "paragraph",
      text: "On the Arc Testnet, USDC plays the role normally reserved for ETH on L1 — every write call pays gas denominated in USDC. The terminal reads the gas balance via the public client's getBalance() entrypoint and formats the result at 18 decimals to match the token's on-chain exponent. This is what populates the \"Gas\" pill in the navbar and the \"50% / MAX\" swap shortcuts.",
    },
    {
      type: "unordered-list",
      items: [
        "Read mechanism: publicClient.getBalance({ address }) — native balance, no contract call.",
        "Decimals: 18 (matches the on-chain USDC exponent at this testnet deployment).",
        "Display rule: enum — \"--\" when disconnected, \"<0.0001\" when the formatted value rounds below 100 micro-units.",
        "Why it matters: attempting to swap or send when this balance is below the dust threshold will surface a Sub-Resource-Fee revert and the transaction will mine but the action will not settle.",
      ],
    },
    {
      type: "subheading",
      text: "$DIBS ERC-20 (18 decimals)",
    },
    {
      type: "paragraph",
      text: "$DIBS is a standard ERC-20 token. Reading the balance requires an explicit balanceOf(target) call against the canonical token contract at 0x2b0ec237e5Cf460962E3eDe88cb676d83C807912. Because the follower path goes through the public client's readContract entrypoint, the terminal must hold a valid address — anything shorter than a 40-hex-character 0x-prefixed string triggers a parse error and silently reverts the read.",
    },
    {
      type: "unordered-list",
      items: [
        "Read mechanism: publicClient.readContract({ address: $DIBS, functionName: 'balanceOf' }).",
        "Decimals: 18 — every ui formatter runs formatUnits(raw, 18) before rendering.",
        "Polling cadence: 8 seconds while the dashboard is mounted; immediate refresh after a confirmed swap.",
        "Formatting rule: Number(formatted).toLocaleString({ maximumFractionDigits: 2 }) so the dashboard never collapses small balances to a \"0.00\" string.",
      ],
    },
    {
      type: "callout",
      severity: "warning",
      title: "Why Balances Drop to Zero",
      text: "A balance rendering as 0 is almost never an empty wallet — it is a misconfigured token address or a wrong-decimals formatter. Cross-check that the contract address matches the canonical 0x… value above, then confirm the decimals you used in formatUnits match the on-chain exponent (decimals()). The terminal already enforces both invariants at startup; custom token imports that skip those checks will misbehave by design.",
    },
  ],
};

// --- 4. AMM Swap Mechanics -------------------------------------------------

const Section4: DocSection = {
  icon: "🔄",
  number: "4",
  anchor: "amm-swap-mechanics",
  title: "Automated Market Maker (AMM) Swap Mechanics",
  intro:
    "The USDC ↔ DIBS swap is executed through the canonical DibsSwapVault contract on Arc Testnet. There are exactly two distinct phases the user must internalise before pressing execute: an approval phase that opens a spend allowance for the vault, and the actual liquidity-pool swap. Forgetting either phase breaks the flow.",
  parts: [
    {
      type: "subheading",
      text: "Phase 1 — Allowance / Approval",
    },
    {
      type: "paragraph",
      text: "Before the vault can pull any $DIBS from the user's wallet to complete a DIBS → USDC burn, the user must approve the vault address as a spender on the $DIBS ERC-20 contract. This is a separate writeContract call against the ERC-20 contract itself (not the vault), and it must succeed before the swap write is dispatched. The USDC → DIBS path does not require an explicit approval because USDC for this testnet is the native asset attached directly to the swap write as `value:`.",
    },
    {
      type: "ordered-list",
      items: [
        "The terminal calls ERC-20 approve(spender: VAULT_ADDRESS, amount: maxAmount) on the $DIBS contract.",
        "The user's wallet surfaces the approval signature — if the user rejects, the swap is aborted before any liquidity is touched.",
        "On confirm, the approval transaction mines and the spend allowance is mirrored on the ERC-20 contract's storage.",
        "Only after the approval receipt is observed does the terminal dispatch the actual swap call against the vault.",
      ],
    },
    {
      type: "subheading",
      text: "Phase 2 — Liquidity-Pool Swap Execution",
    },
    {
      type: "paragraph",
      text: "The actual swap dispatches one of two vault entrypoints depending on direction. When swapping USDC for DIBS, the terminal calls swapUsdcForDibs() and attaches the USDC amount as the transaction value. When swapping DIBS back to USDC, the terminal calls swapDibsForUsdc(dibsAmount), which consumes the previously granted ERC-20 allowance. The current exchange rate of 1 USDC : 10 DIBS is invariant for the Alpha phase — any divergence is treated as a red-flag by the off-chain UI.",
    },
    {
      type: "callout",
      severity: "warning",
      title: "Native Gas Prerequisite",
      text: "Both swap paths require sufficient USDC gas to settle the on-chain write. If your wallet holds zero USDC, the RPC will reject the simulation with a gas-related revert (commonly \"intrinsic gas too low\" or \"insufficient funds for gas\") before any liquidity-pool logic runs — the request will not reach the AMM and no tokens will move. Top up USDC via the Circle Faucet link in the sidebar BEFORE attempting a swap.",
    },
    {
      type: "callout",
      severity: "success",
      title: "Recap",
      text: "Allowed path: USDC → DIBS, settleable on a single writeContract call. Locked path: DIBS → USDC is intentionally disabled during the Testnet Alpha phase to prevent premature pool drainage — the UI will surface a dedicated toast when this direction is attempted.",
    },
  ],
};

// --- 5. Core Platform FAQ --------------------------------------------------

const Section5: DocSection = {
  icon: "❓",
  number: "5",
  anchor: "core-platform-faq",
  title: "Core Platform FAQ",
  intro:
    "Answers to the four most commonly reported runtime questions on the ARCTOR Terminal. Each entry explains the diagnostic behind the symptom and the exact remediation.",
  parts: [
    {
      type: "subheading",
      text: "Why does my dashboard show \"Wrong Network. Please switch to Arc Testnet to use DibsCoin\"?",
    },
    {
      type: "paragraph",
      text: "That banner is triggered exclusively when the active wallet's numeric chain id does NOT equal 5042002. The check is hard-coded against the canonical Arc Testnet id, so any drift — connecting to Ethereum mainnet by accident, switching to a private fork, or being on a permissive local Anvil — will surface the banner immediately.",
    },
    {
      type: "paragraph",
      text: "Remediation: open your wallet extension (or the Privy embedded wallet panel), switch networks to Arc Testnet, and the banner will unmount on the next route render. The terminal will never gatekeep on a place-holder chain variable.",
    },
    {
      type: "subheading",
      text: "Where do I get testnet USDC gas?",
    },
    {
      type: "paragraph",
      text: "Open the sidebar at the bottom-left of the terminal and click the 🚰 Circle Faucet (Get USDC) callout. This opens faucet.circle.com in a new tab. Request a small USDC grant to the wallet address shown in the navbar's identity capsule and wait for the faucet transaction to mine before reattempting any swap.",
    },
    {
      type: "paragraph",
      text: "If your USDC balance still shows 0 after a few minutes, double-check that the receiving address matches the active wallet — pasting the wrong address will route the grant to a totally different account.",
    },
    {
      type: "subheading",
      text: "Why does signing in with Google give me a different address than my extension wallet?",
    },
    {
      type: "paragraph",
      text: "The two topologies are isolated by design. A Google sign-in through Privy provisions a brand-new embedded wallet whose private key is sharded between Google's OAuth envelope and Privy's HSM enclave — that wallet has never touched your extension's seed phrase. To move tokens between the two, you have to explicitly Send from one and Receive on the other; the terminal will not auto-bridge them.",
    },
    {
      type: "paragraph",
      text: "If you want a single canonical address for testing, choose ONE topology up front and stick with it. Mixing the two is supported but requires explicit transfers.",
    },
    {
      type: "subheading",
      text: "Why does my swap fail with a \"transaction simulation failed\" error?",
    },
    {
      type: "paragraph",
      text: "A simulation failure almost always points at one of three root causes. First, the active wallet may be on the wrong chain; the simulation RPC is the same numeric id (5042002) as the live RPC, so any chain switch is amplified at simulation time. Second, the wallet may lack the spending allowance — verify that an approve() transaction has actually mined and was not rejected at the wallet UI. Third, native USDC gas may be insufficient to cover the write — if you see an \"out of gas\" or \"insufficient funds for gas\" revert reason in your wallet UI, top up via the Circle Faucet link in the sidebar and retry.",
    },
    {
      type: "paragraph",
      text: "If none of those resolve the issue, copy the simulated transaction hash from the wallet's activity tab and inspect it on ArcScan — the revert reason there is the source of truth.",
    },
  ],
};

// --- Assembled export ------------------------------------------------------

export const DOCS_CONTENT: DocSection[] = [
  Section1,
  Section2,
  Section3,
  Section4,
  Section5,
];
