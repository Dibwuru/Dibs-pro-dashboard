"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useTheme } from "next-themes";
import { formatUnits, parseUnits, createPublicClient, http, createWalletClient, custom, parseAbiItem } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  AlertTriangle,
  TrendingUp,
  Coins,
  ArrowDown,
  ArrowRight,
  Clock,
  CheckCircle,
  Send,
  ArrowDownToLine,
  X,
  Copy,
  Plus,
  ArrowLeftRight,
  Info,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { GlassCard } from "@/components/GlassCard";

const ARC_TESTNET_CHAIN_ID = 5042002;

// $DIBS ERC-20 Token Configuration
const DIBS_CONTRACT_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
const VAULT_ADDRESS = "0x3ed226184b4a00d1500e04f4fa89281107475597";

const dibsBalanceOfABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// Standard ERC-20 read ABI for token import
const erc20ReadABI = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Vault ABI for swap
const vaultABI = [
  {
    type: "function",
    name: "swapUsdcForDibs",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

// ERC-20 transfer ABI for Send modal
const erc20TransferABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

interface TokenEntry {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  balance: string | null;
  isLoading: boolean;
}

interface ActivityEntry {
  type: string;
  hash: string;
  amount: string;
  status: "Confirmed";
}

const EXCHANGE_RATE = 10; // 1 USDC = 10 DIBS

export default function Home() {
  const { authenticated, ready, user, login } = usePrivy();
  const { wallets: dashboardWallets } = useWallets();

  const isWalletConnected = authenticated && !!user?.wallet?.address;

  const activeDashboardWallet = dashboardWallets[0];
  const activeDashboardChainId = activeDashboardWallet
    ? Number(activeDashboardWallet.chainId.replace('eip155:', ''))
    : null;
  const isWrongNetwork =
    isWalletConnected &&
    activeDashboardChainId !== null &&
    activeDashboardChainId !== ARC_TESTNET_CHAIN_ID;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const displayAddress = user?.wallet?.address;
  const userAddress = (user?.wallet?.address as `0x${string}` | undefined);

  // --- Live $DIBS Balance Fetching (polls every 8 seconds) ---
  const [dibsBalanceRaw, setDibsBalanceRaw] = useState<bigint | null>(null);
  const [dibsBalanceLoading, setDibsBalanceLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setDibsBalanceRaw(null);
      setDibsBalanceLoading(false);
      return;
    }
    let cancelled = false;
    const fetchDibsBalance = async () => {
      if (dibsBalanceRaw === null) {
        setDibsBalanceLoading(true);
      }
      try {
        const balance = await publicClient.readContract({
          address: DIBS_CONTRACT_ADDRESS,
          abi: dibsBalanceOfABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        if (!cancelled) {
          setDibsBalanceRaw(balance);
          setDibsBalanceLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDibsBalanceRaw(null);
          setDibsBalanceLoading(false);
        }
      }
    };
    fetchDibsBalance();
    const interval = setInterval(fetchDibsBalance, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  const dibsBalanceFormatted = dibsBalanceRaw != null
    ? formatUnits(dibsBalanceRaw, 18)
    : null;
  const dibsBalanceDisplay = dibsBalanceFormatted !== null
    ? Number(dibsBalanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : null;

  // --- Receive modal state ---
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveCopied, setReceiveCopied] = useState(false);

  const handleCopyReceive = useCallback(async () => {
    if (!displayAddress) return;
    try {
      await navigator.clipboard.writeText(displayAddress);
      setReceiveCopied(true);
      setTimeout(() => setReceiveCopied(false), 2000);
    } catch {
      // noop
    }
  }, [displayAddress]);

  // --- Dynamic Token Registry ---
  const [tokenList, setTokenList] = useState<TokenEntry[]>([
    {
      name: "USDC Gas",
      symbol: "USDC",
      decimals: 18,
      address: "Native",
      balance: null,
      isLoading: true,
    },
    {
      name: "DibsCoin",
      symbol: "DIBS",
      decimals: 18,
      address: DIBS_CONTRACT_ADDRESS,
      balance: null,
      isLoading: true,
    },
  ]);

  // Sync native gas balance into tokenList (18 decimals)
  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;
    const fetchNative = async () => {
      try {
        const bal = await publicClient.getBalance({ address: userAddress });
        if (!cancelled) {
          const formatted = formatUnits(bal, 18);
          setTokenList((prev) =>
            prev.map((t) =>
              t.address === "Native"
                ? { ...t, balance: formatted, isLoading: false }
                : t
            )
          );
        }
      } catch {
        if (!cancelled) {
          setTokenList((prev) =>
            prev.map((t) =>
              t.address === "Native"
                ? { ...t, balance: null, isLoading: false }
                : t
            )
          );
        }
      }
    };
    fetchNative();
    const interval = setInterval(fetchNative, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  // Sync $DIBS balance into tokenList
  useEffect(() => {
    setTokenList((prev) =>
      prev.map((t) =>
        t.address === DIBS_CONTRACT_ADDRESS
          ? {
              ...t,
              balance: dibsBalanceFormatted,
              isLoading: dibsBalanceLoading,
            }
          : t
      )
    );
  }, [dibsBalanceFormatted, dibsBalanceLoading]);

  // --- Custom Token Import ---
  const [importAddress, setImportAddress] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    const trimmed = importAddress.trim();
    if (!trimmed || !trimmed.startsWith("0x") || trimmed.length !== 42)
      return;
    if (
      tokenList.some((t) => t.address.toLowerCase() === trimmed.toLowerCase())
    ) {
      setImportError("Token already in registry");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const addr = trimmed as `0x${string}`;
      const [symbol, decimals, balance] = await Promise.all([
        publicClient.readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "decimals",
        }),
        userAddress
          ? publicClient.readContract({
              address: addr,
              abi: erc20ReadABI,
              functionName: "balanceOf",
              args: [userAddress],
            })
          : Promise.resolve(BigInt(0)),
      ]);
      const balanceFormatted = formatUnits(balance as bigint, decimals as number);
      setTokenList((prev) => [
        ...prev,
        {
          name: symbol as string,
          symbol: symbol as string,
          decimals: decimals as number,
          address: trimmed,
          balance: balanceFormatted,
          isLoading: false,
        },
      ]);
      setImportAddress("");
    } catch {
      setImportError("Invalid ERC-20 token address");
    } finally {
      setImportLoading(false);
    }
  }, [importAddress, userAddress, tokenList]);

  // --- Live On-Chain Activity Tracking ---
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const seenHashes = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userAddress) {
      setActivityLogs([]);
      seenHashes.current.clear();
      return;
    }

    let cancelled = false;

    const pollActivity = async () => {
      if (cancelled) return;
      setActivityLoading(true);
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - BigInt(10000) > BigInt(0) ? currentBlock - BigInt(10000) : BigInt(0);

        const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

        // Viem handles standard 32-byte hexadecimal padding natively via args compilation
        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { from: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          publicClient.getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { to: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        const newEntries: ActivityEntry[] = [];

        for (const log of sentLogs) {
          const { transactionHash, args } = log as unknown as { transactionHash: string; args: { from: string; to: string; value: bigint } };
          const hash = transactionHash;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);

          const amount = formatUnits(args.value, 18);
          const displayAmount = `${Number(amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} DIBS`;

          newEntries.push({
            type: "Transfer Sent",
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            amount: displayAmount,
            status: "Confirmed",
          });
        }

        for (const log of receivedLogs) {
          const { transactionHash, args } = log as unknown as { transactionHash: string; args: { from: string; to: string; value: bigint } };
          const hash = transactionHash;
          // Skip self-transfers already captured in sentLogs
          if (args.from.toLowerCase() === userAddress.toLowerCase()) continue;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);

          const amount = formatUnits(args.value, 18);
          const displayAmount = `${Number(amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} DIBS`;

          newEntries.push({
            type: "Token Received",
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            amount: displayAmount,
            status: "Confirmed",
          });
        }

        if (newEntries.length > 0 && !cancelled) {
          setActivityLogs((prev) => [...newEntries.reverse(), ...prev].slice(0, 10));
        }
      } catch {
        // silent — no logs to display
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };

    pollActivity();
    const interval = setInterval(pollActivity, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  // --- Swap Module State ---
  const [fromToken, setFromToken] = useState<"USDC" | "DIBS">("USDC");
  const [toToken, setToToken] = useState<"USDC" | "DIBS">("DIBS");
  const [swapInput, setSwapInput] = useState("");

  const flipTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setSwapInput("");
  }, [fromToken, toToken]);

  const swapOutput = useMemo(() => {
    const parsed = parseFloat(swapInput);
    if (isNaN(parsed) || parsed <= 0) return "0";
    if (fromToken === "USDC") {
      return (parsed * EXCHANGE_RATE).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
    }
    // DIBS to USDC not available, but show ratio for UI
    return "0";
  }, [swapInput, fromToken]);

  const isValidSwap = swapInput !== "" && parseFloat(swapInput) > 0;

  const [isSwapping, setIsSwapping] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // --- 50% / MAX helpers ---
  const gasBalanceNum = useMemo(() => {
    const native = tokenList.find((t) => t.address === "Native");
    return native?.balance ? parseFloat(native.balance) : 0;
  }, [tokenList]);

  const dibsBalanceNum = useMemo(
    () => (dibsBalanceFormatted ? parseFloat(dibsBalanceFormatted) : 0),
    [dibsBalanceFormatted]
  );

  // Swap module shortcuts
  const handleSwapFiftyPercent = useCallback(() => {
    if (fromToken === "DIBS") {
      setSwapInput((dibsBalanceNum * 0.5).toString());
    } else {
      setSwapInput((gasBalanceNum * 0.5).toString());
    }
  }, [fromToken, dibsBalanceNum, gasBalanceNum]);

  const handleSwapMax = useCallback(() => {
    if (fromToken === "DIBS") {
      setSwapInput(dibsBalanceNum.toString());
    } else {
      setSwapInput(Math.max(0, gasBalanceNum - 0.01).toString());
    }
  }, [fromToken, dibsBalanceNum, gasBalanceNum]);

  const handleSwapExecute = useCallback(async () => {
    if (!isValidSwap || !userAddress || dashboardWallets.length === 0) return;

    if (fromToken === "DIBS") {
      toast.error("DIBS to USDC liquidation is locked during the Testnet Alpha phase.");
      return;
    }

    // USDC → DIBS swap via vault
    setIsSwapping(true);
    try {
      const activeWallet = dashboardWallets[0];

      // Programmatically switch Privy embedded wallet to Arc Testnet (5042002)
      const currentChainId = Number(activeWallet.chainId.replace('eip155:', ''));
      if (currentChainId !== ARC_TESTNET_CHAIN_ID) {
        await activeWallet.switchChain(ARC_TESTNET_CHAIN_ID);
      }

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      await toast.promise(
        (async () => {
          const hash = await walletClient.writeContract({
            address: VAULT_ADDRESS,
            abi: vaultABI,
            functionName: "swapUsdcForDibs",
            value: parseUnits(swapInput, 6),
          });

          // Wait for on-chain confirmation before resolving the toast
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            throw new Error("Transaction reverted on-chain");
          }

          // Immediately refresh balances so dashboard numbers update
          if (userAddress) {
            try {
              const [newGas, newDibs] = await Promise.all([
                publicClient.getBalance({ address: userAddress }),
                publicClient.readContract({
                  address: DIBS_CONTRACT_ADDRESS,
                  abi: dibsBalanceOfABI,
                  functionName: "balanceOf",
                  args: [userAddress],
                }),
              ]);
              const formattedGas = formatUnits(newGas, 18);
              setDibsBalanceRaw(newDibs);
              setTokenList((prev) =>
                prev.map((t) =>
                  t.address === "Native"
                    ? { ...t, balance: formattedGas, isLoading: false }
                    : t
                )
              );
            } catch {
              // Non-critical — polling will catch up
            }
          }
        })(),
        {
          loading: "Swapping USDC for DIBS...",
          success: "Swap completed successfully!",
          error: (err) => `Swap failed: ${(err as Error).message.slice(0, 80)}`,
        }
      );
      setSwapInput("");
    } catch {
      // toast already handled
    } finally {
      setIsSwapping(false);
    }
  }, [isValidSwap, userAddress, fromToken, swapInput, dashboardWallets]);

  // --- Send Asset Modal ---
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAsset, setSendAsset] = useState<"USDC Gas" | "DibsCoin">("USDC Gas");
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  const isValidSend =
    sendRecipient.trim().startsWith("0x") &&
    sendRecipient.trim().length === 42 &&
    sendAmount !== "" &&
    parseFloat(sendAmount) > 0;

  // Send modal shortcuts
  const handleSendFiftyPercent = useCallback(() => {
    if (sendAsset === "DibsCoin") {
      setSendAmount((dibsBalanceNum * 0.5).toString());
    } else {
      setSendAmount((gasBalanceNum * 0.5).toString());
    }
  }, [sendAsset, dibsBalanceNum, gasBalanceNum]);

  const handleSendMax = useCallback(() => {
    if (sendAsset === "DibsCoin") {
      setSendAmount(dibsBalanceNum.toString());
    } else {
      setSendAmount(Math.max(0, gasBalanceNum - 0.01).toString());
    }
  }, [sendAsset, dibsBalanceNum, gasBalanceNum]);

  const handleSendConfirm = useCallback(async () => {
    if (!isValidSend || !userAddress || dashboardWallets.length === 0) return;

    setIsSending(true);
    try {
      const activeWallet = dashboardWallets[0];

      // Programmatically switch Privy embedded wallet to Arc Testnet (5042002)
      const currentSendChainId = Number(activeWallet.chainId.replace('eip155:', ''));
      if (currentSendChainId !== ARC_TESTNET_CHAIN_ID) {
        await activeWallet.switchChain(ARC_TESTNET_CHAIN_ID);
      }

      const provider = await activeWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: activeWallet.address as `0x${string}`,
        chain: arcTestnet,
        transport: custom(provider),
      });

      if (sendAsset === "USDC Gas") {
        // Native gas transfer
        await toast.promise(
          (async () => {
            const sendHash = await walletClient.sendTransaction({
              to: sendRecipient.trim() as `0x${string}`,
              value: parseUnits(sendAmount, 18),
            });

            // Wait for on-chain confirmation before resolving the toast
            const sendReceipt = await publicClient.waitForTransactionReceipt({ hash: sendHash });
            if (sendReceipt.status !== "success") {
              throw new Error("Transaction reverted on-chain");
            }

            // Immediately refresh balances
            if (userAddress) {
              try {
                const [newGas, newDibs] = await Promise.all([
                  publicClient.getBalance({ address: userAddress }),
                  publicClient.readContract({
                    address: DIBS_CONTRACT_ADDRESS,
                    abi: dibsBalanceOfABI,
                    functionName: "balanceOf",
                    args: [userAddress],
                  }),
                ]);
                const formattedGas = formatUnits(newGas, 18);
                setDibsBalanceRaw(newDibs);
                setTokenList((prev) =>
                  prev.map((t) =>
                    t.address === "Native"
                      ? { ...t, balance: formattedGas, isLoading: false }
                      : t
                  )
                );
              } catch {
                // Non-critical — polling will catch up
              }
            }
          })(),
          {
            loading: "Sending USDC Gas...",
            success: "Transfer completed successfully!",
            error: (err) => `Transfer failed: ${(err as Error).message.slice(0, 80)}`,
          }
        );
      } else {
        // DIBS ERC-20 transfer
        await toast.promise(
          (async () => {
            const transferHash = await walletClient.writeContract({
              address: DIBS_CONTRACT_ADDRESS,
              abi: erc20TransferABI,
              functionName: "transfer",
              args: [sendRecipient.trim() as `0x${string}`, parseUnits(sendAmount, 18)],
            });

            // Wait for on-chain confirmation before resolving the toast
            const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
            if (transferReceipt.status !== "success") {
              throw new Error("Transaction reverted on-chain");
            }

            // Immediately refresh balances
            if (userAddress) {
              try {
                const [newGas, newDibs] = await Promise.all([
                  publicClient.getBalance({ address: userAddress }),
                  publicClient.readContract({
                    address: DIBS_CONTRACT_ADDRESS,
                    abi: dibsBalanceOfABI,
                    functionName: "balanceOf",
                    args: [userAddress],
                  }),
                ]);
                const formattedGas = formatUnits(newGas, 18);
                setDibsBalanceRaw(newDibs);
                setTokenList((prev) =>
                  prev.map((t) =>
                    t.address === "Native"
                      ? { ...t, balance: formattedGas, isLoading: false }
                      : t
                  )
                );
              } catch {
                // Non-critical — polling will catch up
              }
            }
          })(),
          {
            loading: "Sending DIBS tokens...",
            success: "DIBS transfer completed successfully!",
            error: (err) => `Transfer failed: ${(err as Error).message.slice(0, 80)}`,
          }
        );
      }
      setShowSendModal(false);
      setSendRecipient("");
      setSendAmount("");
    } catch {
      // toast already handled
    } finally {
      setIsSending(false);
    }
  }, [isValidSend, userAddress, sendAsset, sendRecipient, sendAmount, dashboardWallets]);

  // --- Stake Modal ---
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakedBalance, setStakedBalance] = useState(0);

  // Stake modal shortcuts (always DIBS)
  const handleStakeFiftyPercent = useCallback(() => {
    setStakeAmount((dibsBalanceNum * 0.5).toString());
  }, [dibsBalanceNum]);

  const handleStakeMax = useCallback(() => {
    setStakeAmount(dibsBalanceNum.toString());
  }, [dibsBalanceNum]);

  const handleStakeConfirm = useCallback(() => {
    const parsed = parseFloat(stakeAmount);
    if (isNaN(parsed) || parsed <= 0) return;

    setStakedBalance((prev) => prev + parsed);
    toast.success("Assets successfully committed to the Sovereign Staking Vault!");
    setShowStakeModal(false);
    setStakeAmount("");
  }, [stakeAmount]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showReceiveModal || showSendModal || showStakeModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showReceiveModal, showSendModal, showStakeModal]);

  // ===== AUTH GATEWAY: Matte Obsidian Onboarding Gateway =====
  if (ready && !authenticated) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[80vh] w-full relative overflow-hidden transition-colors duration-300"
        style={{ background: isDark ? "#030810" : "#F6F8FA" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[130px]"
            style={{ background: isDark ? "rgba(251,191,36,0.06)" : "rgba(251,191,36,0.10)" }}
          />
          <div
            className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-[120px]"
            style={{ background: isDark ? "rgba(249,115,22,0.04)" : "rgba(249,115,22,0.07)" }}
          />
        </div>

        {/* Card */}
        <div
          className="relative z-10 w-full max-w-sm mx-4 flex flex-col items-center text-center rounded-2xl p-8"
          style={{
            background: isDark ? "rgba(5,10,20,0.85)" : "rgba(255,255,255,0.98)",
            border: isDark ? "1px solid rgba(251,191,36,0.22)" : "1px solid rgba(10,22,40,0.10)",
            boxShadow: isDark
              ? "0 0 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.06) inset"
              : "0 4px 32px rgba(10,22,40,0.10), 0 1px 4px rgba(10,22,40,0.06)",
          }}
        >
          {/* Accent line */}
          <div className="mb-8 w-16 h-[3px] rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

          {/* Title */}
          <h1
            className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4 leading-tight"
            style={{ color: isDark ? "#FBBF24" : "#D97706" }}
          >
            ARCTOR<br />Terminal
          </h1>

          {/* Subtitle */}
          <p
            className="text-base max-w-xs mb-10 leading-relaxed"
            style={{ color: isDark ? "#94A3B8" : "#475569" }}
          >
            The Sovereign Decentralized Portal for the $DIBS Ecosystem.
          </p>

          {/* CTA: Connect Wallet (Primary) */}
          <button
            onClick={login}
            className="group relative w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-200 active:scale-[0.97]"
            style={isDark ? {
              background: "linear-gradient(135deg, #FBBF24 0%, #F97316 100%)",
              border: "none",
              color: "#0A0A0A",
              boxShadow: "0 6px 24px rgba(251,191,36,0.40)",
            } : {
              background: "linear-gradient(135deg, #FBBF24 0%, #F97316 100%)",
              border: "none",
              color: "#0A0A0A",
              boxShadow: "0 6px 24px rgba(251,191,36,0.40)",
            }}
          >
            <span className="font-bold">Connect Wallet</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full my-5">
            <div className="flex-1 h-px" style={{ background: isDark ? "rgba(251,191,36,0.12)" : "rgba(10,22,40,0.08)" }} />
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">or</span>
            <div className="flex-1 h-px" style={{ background: isDark ? "rgba(251,191,36,0.12)" : "rgba(10,22,40,0.08)" }} />
          </div>

          {/* CTA: Sign In with Email (Secondary) */}
          <button
            onClick={login}
            className="group relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-200 active:scale-[0.97]"
            style={isDark ? {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(251,191,36,0.35)",
              color: "#FDE68A",
              boxShadow: "0 0 40px rgba(251,191,36,0.08)",
            } : {
              background: "rgba(10,22,40,0.03)",
              border: "1px solid rgba(251,191,36,0.30)",
              color: "#D97706",
              boxShadow: "none",
            }}
          >
            <span className="font-bold">Sign In with Email</span>
          </button>

          {/* Footer */}
          <p className="mt-8 text-xs tracking-wide text-zinc-500 dark:text-zinc-400">
            Powered by Arc Testnet • Chain 5042002
          </p>
        </div>
      </div>
    );
  }

  // During initial load (ready === false), render nothing to avoid flash
  if (!ready) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Wrong Network Warning Banner */}
      {isWrongNetwork && (
        <div className="sticky top-16 z-40 flex items-center justify-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            You are connected to an unsupported network. Please switch to Arc
            Testnet (Chain ID: {ARC_TESTNET_CHAIN_ID}) in your wallet.
          </p>
        </div>
      )}

      <section className="relative flex-1 overflow-hidden">
        <div className="relative max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
          {/* ===== DASHBOARD VIEW ===== */}
          <div className="space-y-8">
            {/* Balance Hero Card */}
            <GlassCard className="p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.08] rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                      Portfolio Value
                    </p>
                    <div className="flex items-baseline gap-3 mt-1">
                      <h1
                        className="text-4xl sm:text-5xl font-bold text-slate-950 dark:text-slate-50 tracking-tight tabular-nums"
                        style={{
                          textShadow:
                            "0 0 40px rgba(245, 158, 11, 0.18)",
                        }}
                      >
                        {dibsBalanceLoading
                          ? "..."
                          : dibsBalanceDisplay ?? "—"}
                      </h1>
                      <span className="text-xl sm:text-2xl font-semibold text-slate-600 dark:text-slate-300">
                        DIBS
                      </span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Rate
                    </p>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50 mb-2">
                      1 USDC = {EXCHANGE_RATE} DIBS
                    </p>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success/10 border border-success/20">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-xs font-semibold text-success">
                        +1.5% (24h)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Staked Balance Tracker */}
                {stakedBalance > 0 && (
                  <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      Staked: {stakedBalance.toLocaleString()} DIBS
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    {displayAddress
                      ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                      : "Connected"}
                  </span>
                </div>

                {/* Send / Receive / Stake Action Sub-Row */}
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setShowSendModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-950 dark:bg-slate-50 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-[0.97] transition-all shadow-sm flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={() => setShowReceiveModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] active:scale-[0.97] transition-all shadow-sm flex-shrink-0"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Receive
                  </button>
                  <button
                    onClick={() => setShowStakeModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-primary/20 text-primary bg-primary/[0.05] hover:bg-primary/[0.1] active:scale-[0.97] transition-all shadow-sm flex-shrink-0"
                  >
                    <Lock className="w-4 h-4" />
                    Stake
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Token Registry Asset Cards */}
            <div className="flex flex-col md:grid md:grid-cols-3 gap-4">
              {tokenList.map((token) => {
                const iconRing =
                  token.symbol === "USDC"
                    ? "bg-emerald-500/15 border-emerald-500/20"
                    : token.symbol === "DIBS"
                    ? "bg-amber-500/15 border-amber-500/20"
                    : "bg-blue-500/15 border-blue-500/20";
                const iconColor =
                  token.symbol === "USDC"
                    ? "text-emerald-500"
                    : token.symbol === "DIBS"
                    ? "text-amber-500"
                    : "text-blue-500";
                return (
                <div
                  key={token.address}
                  className="rounded-xl bg-white dark:bg-[#0C1420]/70 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 p-6 hover:border-slate-300 dark:hover:border-amber-500/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${iconRing}`}>
                      <Coins className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                        {token.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {token.isLoading
                      ? "..."
                      : token.balance !== null
                        ? Number(token.balance).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                    {token.symbol}
                  </p>
                </div>
                );
              })}

              {/* Import Custom Token Card */}
              <div className="rounded-xl bg-white dark:bg-[#0C1420]/70 backdrop-blur-md border border-dashed border-slate-300 dark:border-amber-500/20 p-6">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  Import Custom Token Address
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={importAddress}
                    onChange={(e) => {
                      setImportAddress(e.target.value);
                      setImportError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleImport();
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400 focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={handleImport}
                    disabled={importLoading || !importAddress.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5 flex-shrink-0"
                  >
                    {importLoading ? (
                      "..."
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Import
                  </button>
                </div>
                {importError && (
                  <p className="text-[10px] text-error mt-2">{importError}</p>
                )}
              </div>
            </div>

            {/* ===== QUICK SWAP MODULE ===== */}
            <GlassCard className="p-8">
              <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50 mb-6">
                Quick Swap
              </h3>
              <div className="space-y-4">
                {/* From Token */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      You Pay
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleSwapFiftyPercent}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                      >
                        50%
                      </button>
                      <button
                        onClick={handleSwapMax}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <div className="input-box relative flex items-center p-4">
                    <input
                      type="number"
                      placeholder="0.0"
                      value={swapInput}
                      onChange={(e) => setSwapInput(e.target.value)}
                      className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
                    />
                    <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                      {fromToken}
                    </span>
                  </div>
                </div>

                {/* Flip Arrow Toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={flipTokens}
                    className="input-box cursor-pointer select-none active:scale-95 p-2 rounded-xl text-amber-600 dark:text-primary hover:scale-110 transition-all"
                    title="Flip tokens"
                    aria-label="Flip token direction"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>

                {/* To Token */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                    You Receive
                  </label>
                  <div className="input-box relative flex items-center p-4">
                    <input
                      type="text"
                      readOnly
                      value={swapOutput}
                      className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none pr-20 tabular-nums"
                    />
                    <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                      {toToken}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="input-box flex items-center gap-2 px-3 py-2 rounded-lg">
                  <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    1 USDC = {EXCHANGE_RATE} DIBS
                  </span>
                </div>

                {/* Execute Swap */}
                <button
                  onClick={handleSwapExecute}
                  disabled={!isWalletConnected || !isValidSwap || isSwapping || isWrongNetwork}
                  className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                    !isWalletConnected || !isValidSwap || isSwapping || isWrongNetwork
                      ? "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
                      : "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.98]"
                  }`}
                >
                  {isSwapping ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Swapping...
                    </>
                  ) : !isWalletConnected ? (
                    "Connect Wallet to Swap"
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      Execute Swap
                    </>
                  )}
                </button>
              </div>
            </GlassCard>

            {/* Recent Activity */}
            <GlassCard className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                  Recent Activity
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Live $DIBS transfers
                </span>
              </div>
              <div className="overflow-x-auto -mx-2">
                {activityLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activityLoading
                        ? "Scanning on-chain activity..."
                        : "No $DIBS transfer activity detected for your wallet yet"}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="text-right py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="text-right py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((tx, i) => (
                        <tr
                          key={tx.hash + i}
                          className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 flex items-center justify-center flex-shrink-0">
                                {tx.type.includes("Sent") ? (
                                  <ArrowRight className="w-3.5 h-3.5 text-warning -rotate-45" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-success" />
                                )}
                              </div>
                              <span className="text-xs font-medium text-slate-950 dark:text-slate-50 truncate max-w-[140px]">
                                {tx.type}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <span className="text-xs font-mono font-medium text-slate-950 dark:text-slate-50">
                              {tx.amount}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/20">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </GlassCard>
          </div>


        </div>
      </section>

      {/* ===== RECEIVE MODAL OVERLAY ===== */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowReceiveModal(false)}
          />
          {/* Modal card */}
          <div className="tooltip-card relative w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Receive Funds
              </h3>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live SVG QR Code */}
            <div className="mb-6 p-8 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <QRCode
                value={user?.wallet?.address || ""}
                size={180}
                fgColor="#D4AF37"
                bgColor="transparent"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Scan QR Code to Fund Account
              </span>
            </div>

            {/* Wallet Address Display + Copy */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Your Wallet Address
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                  {displayAddress || "—"}
                </code>
                <button
                  onClick={handleCopyReceive}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex-shrink-0"
                  title="Copy address"
                >
                  {receiveCopied ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowReceiveModal(false)}
              className="mt-6 w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ===== SEND ASSET MODAL ===== */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSendModal(false)}
          />
          <div className="tooltip-card relative w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Send Assets
              </h3>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setSendRecipient("");
                  setSendAmount("");
                }}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Asset Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                  Select Asset
                </label>
                <select
                  value={sendAsset}
                  onChange={(e) => setSendAsset(e.target.value as "USDC Gas" | "DibsCoin")}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-950 dark:text-slate-50 outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="USDC Gas">USDC Gas</option>
                  <option value="DibsCoin">DibsCoin (DIBS)</option>
                </select>
              </div>

              {/* Recipient Address */}
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                  Recipient Wallet Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Amount
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSendFiftyPercent}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                    >
                      50%
                    </button>
                    <button
                      onClick={handleSendMax}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="input-box relative flex items-center p-4">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
                  />
                  <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                    {sendAsset === "USDC Gas" ? "USDC" : "DIBS"}
                  </span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleSendConfirm}
                disabled={!isValidSend || isSending}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  isValidSend && !isSending
                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                    : "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
                }`}
              >
                <Send className="w-4 h-4" />
                Confirm Transfer
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setSendRecipient("");
                  setSendAmount("");
                }}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STAKE MODAL ===== */}
      {showStakeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowStakeModal(false)}
          />
          <div className="tooltip-card relative w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Stake DIBS
              </h3>
              <button
                onClick={() => setShowStakeModal(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Your Balance */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#121826]/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Available Balance
                </span>
                <span className="text-sm font-bold text-slate-950 dark:text-slate-50">
                  {dibsBalanceDisplay ?? "0"} DIBS
                </span>
              </div>

              {/* Stake Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Amount to Stake
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleStakeFiftyPercent}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                    >
                      50%
                    </button>
                    <button
                      onClick={handleStakeMax}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-[0.95] transition-all"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="input-box relative flex items-center p-4">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="w-full bg-transparent text-2xl font-semibold text-slate-950 dark:text-slate-50 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500/50 pr-20"
                  />
                  <span className="token-badge absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-sm font-semibold">
                    DIBS
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Estimated APY</span>
                  <span className="text-success font-medium">12.5%</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Lock Period</span>
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5" />7 days
                  </span>
                </div>
              </div>

              {/* Confirm Stake */}
              <button
                onClick={handleStakeConfirm}
                disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  stakeAmount && parseFloat(stakeAmount) > 0
                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98]"
                    : "opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500"
                }`}
              >
                <Lock className="w-4 h-4" />
                Confirm Stake
              </button>

              <button
                onClick={() => setShowStakeModal(false)}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
