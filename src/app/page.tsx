"use client";

import { usePrivy, useWallets, useConnectWallet } from "@privy-io/react-auth";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useChainId, useDisconnect } from "wagmi";
import { formatUnits, parseUnits, createPublicClient, http, createWalletClient, custom, parseAbiItem, decodeEventLog } from "viem";
import { arcTestnet } from "@/components/Web3Provider";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  TrendingUp,
  Coins,
  ArrowDown,
  ArrowRight,
  Clock,
  CheckCircle,
  Loader2,
  Send,
  ArrowDownToLine,
  X,
  Copy,
  Plus,
  ArrowLeftRight,
  Info,
  LogOut,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { GlassCard } from "@/components/GlassCard";
import { SendModal } from "@/components/SendModal";
import {
  VAULT_ADDRESS,
  DIBS_CONTRACT_ADDRESS,
  EXCHANGE_RATE,
  ARC_TESTNET_CHAIN_ID,
  ARC_EXPLORER_URL,
  vaultABI as vaultConfigABI,
} from "@/vaultConfig";

const dibsBalanceOfABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const fallbackPublicClient = createPublicClient({
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

interface TokenEntry {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  balance: string | null;
  isLoading: boolean;
}

interface ActivityEntry {
  action: "SEND" | "BURN" | "STAKE" | "RECEIVE" | "SWAP";
  hash: string;
  fullHash: string;
  amount: string;
  timestamp: number;
  status: "Confirmed" | "Pending" | "Failed";
  key: string;
}


export default function Home() {
  const { authenticated, ready, user, login, logout } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets: dashboardWallets } = useWallets();
  const { disconnect } = useDisconnect();

  // External wallet address fallback for users who connect via MetaMask without Privy auth
  const externalWalletAddress = dashboardWallets.length > 0 ? (dashboardWallets[0].address as string) : null;
  const isWalletConnected = (authenticated && !!user?.wallet?.address) || !!externalWalletAddress;
  // Unified active state: supports both Privy auth and external wallet connections
  const isUIActive = ready && (authenticated || (dashboardWallets && dashboardWallets.length > 0));

  const activeDashboardWallet = dashboardWallets[0];
  const activeDashboardChainId = activeDashboardWallet
    ? Number(activeDashboardWallet.chainId.replace('eip155:', ''))
    : null;
  const wagmiChainId = useChainId();
  const [nativeBalanceFetched, setNativeBalanceFetched] = useState(false);
  const isWrongNetwork =
    isUIActive &&
    activeDashboardChainId !== null &&
    activeDashboardChainId !== ARC_TESTNET_CHAIN_ID &&
    wagmiChainId !== ARC_TESTNET_CHAIN_ID &&
    !nativeBalanceFetched;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const userAddress = ((dashboardWallets[0]?.address || externalWalletAddress) as `0x${string}` | undefined);
  const displayAddress = userAddress;

  // Dynamic provider state so balance reads & writes route through the active wallet
  const [homeWalletProvider, setHomeWalletProvider] = useState<any>(null);

  useEffect(() => {
    const wallet = dashboardWallets[0];
    if (!wallet) {
      setHomeWalletProvider(null);
      return;
    }
    let cancelled = false;
    wallet.getEthereumProvider().then((p: any) => {
      if (!cancelled) setHomeWalletProvider(p);
    }).catch(() => {
      if (!cancelled) setHomeWalletProvider(null);
    });
    return () => { cancelled = true; };
  }, [dashboardWallets]);

  const getPublicClient = useCallback(() => {
    if (homeWalletProvider) {
      return createPublicClient({ chain: arcTestnet, transport: custom(homeWalletProvider) });
    }
    return fallbackPublicClient;
  }, [homeWalletProvider]);

  // Nuclear disconnect: clear wagmi state + disconnect external wallets + wipe Privy session + clear caches + reload
  const handleDisconnect = useCallback(async () => {
    try {
      disconnect();
    } catch {
      // noop
    }
    // Disconnect all external wallets first (MetaMask, etc.)
    if (dashboardWallets.length > 0) {
      try {
        await Promise.all(dashboardWallets.map((w) => w.disconnect()));
      } catch {
        // ignore wallet disconnect errors
      }
    }
    try {
      await logout();
    } catch {
      // logout may be no-op if not authenticated
    }
    localStorage.clear();
    window.location.reload();
  }, [disconnect, logout, dashboardWallets]);

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
        const balance = await getPublicClient().readContract({
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
        const bal = await getPublicClient().getBalance({ address: userAddress });
        if (!cancelled) {
          const formatted = formatUnits(bal, 18);
          setNativeBalanceFetched(true);
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
      const addr = trimmed as `0x${string}`;        const [symbol, decimals, balance] = await Promise.all([
          getPublicClient().readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "symbol",
        }),
        getPublicClient().readContract({
          address: addr,
          abi: erc20ReadABI,
          functionName: "decimals",
        }),            userAddress
              ? getPublicClient().readContract({
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

  // --- Pending entry helpers ---
  const generateKey = useCallback(
    () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const addPendingEntry = useCallback(
    (action: ActivityEntry["action"], amount: string): string => {
      const key = generateKey();
      const entry: ActivityEntry = {
        action,
        hash: "Pending...",
        fullHash: "",
        amount,
        timestamp: Math.floor(Date.now() / 1000),
        status: "Pending",
        key,
      };
      setActivityLogs((prev) => [entry, ...prev].slice(0, 10));
      return key;
    },
    [generateKey]
  );

  const updateEntry = useCallback(
    (key: string, updates: Partial<Pick<ActivityEntry, "hash" | "fullHash" | "status">>) => {
      setActivityLogs((prev) =>
        prev.map((e) => {
          if (e.key !== key) return e;
          return { ...e, ...updates } as ActivityEntry;
        })
      );
    },
    []
  );

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
      try {          const currentBlock = await getPublicClient().getBlockNumber();
        const fromBlock = currentBlock - BigInt(10000) > BigInt(0) ? currentBlock - BigInt(10000) : BigInt(0);

        const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
        const assetSwappedEventAbi = parseAbiItem('event AssetSwapped(address indexed user, string direction, uint256 amountIn, uint256 amountOut)');
        const tokensStakedEventAbi = parseAbiItem('event TokensStaked(address indexed user, uint256 amount, uint256 releaseTime, uint256 apyRate, uint256 lockDays)');

        // Viem handles standard 32-byte hexadecimal padding natively via args compilation
        const [sentLogs, receivedLogs, swapLogs, stakeLogs] = await Promise.all([
          getPublicClient().getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { from: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: DIBS_CONTRACT_ADDRESS,
            event: transferEventAbi,
            args: { to: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: VAULT_ADDRESS,
            event: assetSwappedEventAbi,
            args: { user: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
          getPublicClient().getLogs({
            address: VAULT_ADDRESS,
            event: tokensStakedEventAbi,
            args: { user: userAddress },
            fromBlock,
            toBlock: currentBlock,
          }),
        ]);

        const newEntries: ActivityEntry[] = [];

        // Collect all unique block numbers and fetch timestamps in parallel
        const allLogs = [...sentLogs, ...receivedLogs, ...swapLogs, ...stakeLogs] as unknown as { blockNumber: bigint }[];
        const uniqueBlockNums = [...new Set(allLogs.map((l) => l.blockNumber?.toString() ?? "0"))];
        const blockTimestamps = new Map<string, number>();
        const blocks = await Promise.all(
          uniqueBlockNums.map((bn) =>
            getPublicClient().getBlock({ blockNumber: BigInt(bn) }).catch(() => null)
          )
        );
        blocks.forEach((block, i) => {
          if (block) blockTimestamps.set(uniqueBlockNums[i], Number(block.timestamp));
        });
        const getBlockTime = (bn: bigint): number =>
          blockTimestamps.get(bn.toString()) ?? Math.floor(Date.now() / 1000);

        for (const log of sentLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { from: string; to: string; value: bigint } };
          const hash = transactionHash;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);

          const amount = formatUnits(args.value, 18);
          const displayAmount = `${Number(amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} DIBS`;
          const ts = await getBlockTime(blockNumber);

          newEntries.push({
            action: "SEND",
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            fullHash: hash,
            amount: displayAmount,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${hash}`,
          });
        }

        for (const log of receivedLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { from: string; to: string; value: bigint } };
          const hash = transactionHash;
          if (args.from.toLowerCase() === userAddress.toLowerCase()) continue;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);

          const amount = formatUnits(args.value, 18);
          const displayAmount = `${Number(amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} DIBS`;
          const ts = await getBlockTime(blockNumber);

          newEntries.push({
            action: "RECEIVE",
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            fullHash: hash,
            amount: displayAmount,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${hash}`,
          });
        }

        // Parse V2 Vault AssetSwapped events (containing "direction" string)
        for (const log of swapLogs) {
          const { transactionHash, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint };
          const hash = transactionHash;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);
          try {
            const decoded = decodeEventLog({
              abi: vaultConfigABI,
              data: (log as unknown as { data: `0x${string}` }).data,
              topics: (log as unknown as { topics: [signature: `0x${string}`, ...args: `0x${string}`[]] }).topics,
            });
            if (decoded.eventName === "AssetSwapped") {
              const args = decoded.args as unknown as { direction: string; amountIn: bigint; amountOut: bigint };
              const isBurn = args.direction === "DIBS_TO_USDC";
              const dirLabel = isBurn ? "DIBS → USDC" : "USDC → DIBS";
              const amountOutFormatted = formatUnits(args.amountOut, 18);
              const displayToken = isBurn ? "USDC" : "DIBS";
              const ts = await getBlockTime(blockNumber);
              newEntries.push({
                action: isBurn ? "BURN" : "SWAP",
                hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
                fullHash: hash,
                amount: `${Number(amountOutFormatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayToken}`,
                timestamp: ts,
                status: "Confirmed",
                key: `onchain_${hash}`,
              });
            }
          } catch {
            // skip unparseable logs
          }
        }

        // Parse TokensStaked events
        for (const log of stakeLogs) {
          const { transactionHash, args, blockNumber } = log as unknown as { transactionHash: string; blockNumber: bigint; args: { user: string; amount: bigint; releaseTime: bigint } };
          const hash = transactionHash;
          if (seenHashes.current.has(hash)) continue;
          seenHashes.current.add(hash);

          const amount = formatUnits(args.amount, 18);
          const displayAmount = `${Number(amount).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })} DIBS`;
          const ts = await getBlockTime(blockNumber);

          newEntries.push({
            action: "STAKE",
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            fullHash: hash,
            amount: displayAmount,
            timestamp: ts,
            status: "Confirmed",
            key: `onchain_${hash}`,
          });
        }

        if (newEntries.length > 0 && !cancelled) {
          setActivityLogs((prev) => {
            // Filter out entries already in the list (e.g. as pending entries with matching fullHash)
            const existingHashes = new Set(prev.map((e) => e.fullHash).filter(Boolean));
            const trulyNew = newEntries.filter((ne) => !existingHashes.has(ne.fullHash));
            // Update any pending entries that now have a confirmed on-chain match
            const updated = prev.map((entry) => {
              if (entry.status === "Pending" && entry.fullHash) {
                const match = newEntries.find((ne) => ne.fullHash === entry.fullHash);
                if (match) return { ...entry, status: "Confirmed" as const, hash: match.hash, timestamp: match.timestamp } as ActivityEntry;
              }
              return entry;
            });
            return [...trulyNew.reverse(), ...updated].slice(0, 10);
          });
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

    // Balance check: insufficient USDC gas
    const inputNum = parseFloat(swapInput);
    if (fromToken === "USDC" && inputNum > gasBalanceNum) {
      toast.error("Insufficient USDC balance for this action.");
      return;
    }

    // USDC → DIBS swap via vault
    const pendingKey = addPendingEntry(
      "SWAP",
      `${swapInput} USDC → DIBS`
    );
    setIsSwapping(true);
    try {
      const activeWallet = dashboardWallets[0];

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
            value: parseUnits(swapInput, 18),
          });

          // Update pending entry with the real transaction hash
          updateEntry(pendingKey, {
            hash: `${hash.slice(0, 6)}...${hash.slice(-4)}`,
            fullHash: hash,
          });

          // Wait for on-chain confirmation before resolving the toast
          const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            updateEntry(pendingKey, { status: "Failed" });
            throw new Error("Transaction reverted on-chain");
          }

          // Mark as confirmed
          updateEntry(pendingKey, { status: "Confirmed" });

          // Immediately refresh balances so dashboard numbers update
          if (userAddress) {
            try {
              const [newGas, newDibs] = await Promise.all([
                getPublicClient().getBalance({ address: userAddress }),
                getPublicClient().readContract({
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
          error: (err) => {
            updateEntry(pendingKey, { status: "Failed" });
            const e = err as Error & { code?: number; cause?: { code?: number } };
            if (e?.code === 4001 || e?.cause?.code === 4001 || String(e?.message || "").includes("User rejected")) {
              return "Transaction canceled by user";
            }
            return `Swap failed: ${(err as Error).message.slice(0, 80)}`;
          },
        }
      );
      setSwapInput("");
    } catch {
      // Also handle rejection at the outer level (catches writeContract rejection before promise resolves)
      updateEntry(pendingKey, { status: "Failed" });
    } finally {
      setIsSwapping(false);
    }
  }, [isValidSwap, userAddress, fromToken, swapInput, dashboardWallets, gasBalanceNum, addPendingEntry, updateEntry]);

  // --- Send Modal visibility (component renders inline) ---
  const [showSendModal, setShowSendModal] = useState(false);

  // --- On-Chain Staked Balance (fetched from vault) ---
  const [stakedBalance, setStakedBalance] = useState<number>(0);
  const [stakedLoading, setStakedLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) {
      setStakedBalance(0);
      return;
    }
    let cancelled = false;
    const fetchStakes = async () => {
      setStakedLoading(true);
      try {
        const count = (await getPublicClient().readContract({
          address: VAULT_ADDRESS,
          abi: vaultConfigABI,
          functionName: "getUserStakesCount",
          args: [userAddress],
        })) as bigint;

        let total = BigInt(0);
        for (let i = 0; i < Number(count); i++) {
          const raw = (await getPublicClient().readContract({
            address: VAULT_ADDRESS,
            abi: vaultConfigABI,
            functionName: "userStakes",
            args: [userAddress, BigInt(i)],
          })) as [bigint, bigint, bigint, bigint, boolean];
          if (!raw[4]) {
            total += raw[0];
          }
        }
        if (!cancelled) {
          setStakedBalance(parseFloat(formatUnits(total, 18)));
        }
      } catch {
        if (!cancelled) setStakedBalance(0);
      } finally {
        if (!cancelled) setStakedLoading(false);
      }
    };
    fetchStakes();
    const interval = setInterval(fetchStakes, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress]);

  const router = useRouter();

  // Lock body scroll when receive modal is open
  useEffect(() => {
    if (showReceiveModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showReceiveModal]);

  // ===== AUTH GATEWAY: Show onboarding only when fully disconnected =====
  // During initial load (ready === false), render nothing to avoid flash
  if (!ready) {
    return null;
  }

  if (!isUIActive) {
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
            onClick={() => connectWallet()}
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

  return (
    <div className="flex flex-col flex-1">
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
                      Staked: {stakedLoading ? "..." : stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} DIBS
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

                {/* Send / Receive / Stake / Disconnect Action Sub-Row */}
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
                    onClick={() => router.push("/stake")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-primary/20 text-primary bg-primary/[0.05] hover:bg-primary/[0.1] active:scale-[0.97] transition-all shadow-sm flex-shrink-0"
                  >
                    <Lock className="w-4 h-4" />
                    Stake
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-500/20 text-red-500 bg-red-500/[0.05] hover:bg-red-500/[0.1] active:scale-[0.97] transition-all shadow-sm flex-shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
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
                  disabled={!isUIActive || !isValidSwap || isSwapping || isWrongNetwork}
                  className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                    !isUIActive || !isValidSwap || isSwapping || isWrongNetwork
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
                  ) : !isUIActive ? (
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
                          Action
                        </th>
                        <th className="text-left py-3 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Time
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
                      {activityLogs.map((tx, i) => {
                        const actionColors: Record<string, string> = {
                          SEND: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
                          BURN: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
                          STAKE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                          RECEIVE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                          SWAP: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
                        };
                        const statusColors: Record<string, string> = {
                          Confirmed: "bg-success/10 text-success border-success/20",
                          Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          Failed: "bg-error/10 text-error border-error/20",
                        };

                        const timeAgo = (ts: number): string => {
                          const seconds = Math.floor(Date.now() / 1000) - ts;
                          if (seconds < 60) return "just now";
                          if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
                          if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
                          return new Date(ts * 1000).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        };

                        return (
                          <tr
                            key={tx.key || (tx.fullHash + i)}
                            className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-fade-in ${tx.status === "Pending" ? "activity-pending-row" : ""}`}
                          >
                            {/* Action Badge */}
                            <td className="py-3.5 px-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actionColors[tx.action] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                              >
                                {tx.action}
                              </span>
                            </td>
                            {/* Timestamp */}
                            <td className="py-3.5 px-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {timeAgo(tx.timestamp)}
                              </span>
                            </td>
                            {/* Amount */}
                            <td className="py-3.5 px-2 text-right">
                              <span className="text-xs font-mono font-medium text-slate-950 dark:text-slate-50">
                                {tx.amount}
                              </span>
                            </td>
                            {/* Status + Explorer Link */}
                            <td className="py-3.5 px-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[tx.status] || statusColors.Pending} ${tx.status === "Pending" ? "animate-pulse" : ""}`}
                                >
                                  {tx.status === "Confirmed" && (
                                    <CheckCircle className="w-2.5 h-2.5" />
                                  )}
                                  {tx.status === "Pending" && (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  )}
                                  {tx.status}
                                </span>
                                {tx.status !== "Pending" && tx.fullHash && (
                                  <a
                                    href={`${ARC_EXPLORER_URL}/tx/${tx.fullHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-primary hover:text-primary-hover hover:underline transition-colors whitespace-nowrap"
                                    title="View on ArcScan"
                                  >
                                    View
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        gasBalanceNum={gasBalanceNum}
        dibsBalanceNum={dibsBalanceNum}
        addPendingEntry={addPendingEntry}
        updateEntry={updateEntry}
      />

    </div>
  );
}
