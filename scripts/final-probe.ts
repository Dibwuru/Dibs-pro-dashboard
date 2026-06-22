import { createPublicClient, createWalletClient, http, defineChain, toHex, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

// Read private key
const envContent = fs.readFileSync("/root/my-ai-project/.env", "utf-8");
let privateKey: string | null = null;
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed === "") continue;
  const match = trimmed.match(/^PRIVATE_KEY\s*=\s*(0x[a-fA-F0-9]+)/);
  if (match) { privateKey = match[1]; break; }
}
if (!privateKey) { console.log("ERROR: No private key"); process.exit(1); }

const account = privateKeyToAccount(privateKey as `0x${string}`);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7" as `0x${string}`;
const OWNER = "0x979Bd52451C723456Df1EBEF8a0Ee197765Df294" as `0x${string}`;
const DIBS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912" as `0x${string}`;

const remaining = ["0x43000823", "0x565b6040", "0x84828501", "0xe7f27b93"];

async function main() {
  // ===============================================
  // PART 1: Check if these are event signatures
  // ===============================================
  console.log("═══ PART 1: Event Signature Check ═══\n");
  
  const eventSigs = [
    "AssetSwapped(address,string,uint256,uint256)",
    "ExchangeRateUpdated(uint256,uint256)",
    "TokensStaked(address,uint256,uint256,uint256,uint256)",
    "TokensUnstaked(address,uint256,uint256)",
    "OwnershipTransferred(address,address)",
    "Paused(address)",
    "Unpaused(address)",
    "Staked(address,uint256,uint256)",
    "Unstaked(address,uint256,uint256)",
    "Swapped(address,string,uint256,uint256)",
    "Swap(address,string,uint256,uint256)",
    "Transfer(address,address,uint256)",
    "Approval(address,address,uint256)",
    "EmergencyWithdraw(address,uint256)",
    "Withdraw(address,uint256)",
    "Deposit(address,uint256)",
    "TokenRescue(address,uint256)",
    "Rescue(address,uint256)",
    "Recovered(address,uint256)",
    "Drained(address,uint256)",
  ];
  
  for (const sig of eventSigs) {
    const hash = keccak256(toHex(sig));
    const sel = "0x" + hash.slice(2, 10);
    if (remaining.includes(sel)) {
      console.log(`✅ EVENT MATCH: ${sel} => ${sig}`);
    }
  }
  
  // ===============================================
  // PART 2: Creative eth_call probes
  // ===============================================
  console.log("\n═══ PART 2: Creative eth_call Probes ═══\n");
  
  for (const sel of remaining) {
    console.log(`─── Testing ${sel} ───`);
    
    // Try with owner-only calldata (msg.sender = owner)
    // Some functions check msg.sender == owner in the function body
    
    // Pattern: (address owner, address token, uint256 amount)
    const patterns = [
      { label: "owner+token+amount", data: sel + "000000000000000000000000" + OWNER.slice(2) + "000000000000000000000000" + DIBS.slice(2) + (500000n * 10n**18n).toString(16).padStart(64, "0") },
      { label: "token+owner+amount", data: sel + "000000000000000000000000" + DIBS.slice(2) + "000000000000000000000000" + OWNER.slice(2) + (500000n * 10n**18n).toString(16).padStart(64, "0") },
      { label: "amount only", data: sel + (500000n * 10n**18n).toString(16).padStart(64, "0") },
      { label: "zero amount", data: sel + "0000000000000000000000000000000000000000000000000000000000000000" },
      { label: "small amount", data: sel + "0000000000000000000000000000000000000000000000000000000000000001" },
      { label: "address zero token", data: sel + "0000000000000000000000000000000000000000000000000000000000000000" + "000000000000000000000000" + OWNER.slice(2) },
      { label: "bool true", data: sel + "0000000000000000000000000000000000000000000000000000000000000001" },
      { label: "bytes32 zero", data: sel + "0000000000000000000000000000000000000000000000000000000000000000" },
    ];
    
    for (const p of patterns) {
      try {
        const result = await publicClient.call({
          to: V2,
          data: p.data as `0x${string}`,
          account: OWNER,
        });
        console.log(`  ${p.label}: ✅ ${result.data || "0x"}`);
      } catch (e: any) {
        const msg = e?.shortMessage || e?.message || String(e);
        // Only show first 80 chars
        console.log(`  ${p.label}: ❌ ${msg.slice(0, 80)}`);
      }
    }
    console.log("");
  }
  
  // ===============================================
  // PART 3: Check owner's stake count in V2
  // ===============================================
  console.log("═══ PART 3: Owner Stake Check ═══\n");
  
  try {
    const data = "0x98dc8dea000000000000000000000000" + OWNER.slice(2);
    const result = await publicClient.call({ to: V2, data: data as `0x${string}` });
    const count = result.data ? BigInt(result.data) : 0n;
    console.log(`Owner stake count: ${count}`);
    
    // If there are stakes, check each one
    if (count > 0n) {
      console.log(`\nChecking owner's stakes...`);
      for (let i = 0n; i < count && i < 5n; i++) {
        const idx = i.toString(16).padStart(64, "0");
        const stakeData = "0xb5d5b5fa" + "000000000000000000000000" + OWNER.slice(2) + idx;
        try {
          const r = await publicClient.call({ to: V2, data: stakeData as `0x${string}` });
          if (r.data && r.data !== "0x") {
            // Parse the tuple: amount(uint256), releaseTime(uint256), apyRate(uint256), lockDays(uint256), claimed(bool)
            const data = r.data.slice(2);
            const amount = BigInt("0x" + data.slice(0, 64));
            const releaseTime = BigInt("0x" + data.slice(64, 128));
            const apyRate = BigInt("0x" + data.slice(128, 192));
            const lockDays = BigInt("0x" + data.slice(192, 256));
            const claimed = BigInt("0x" + data.slice(256, 320));
            console.log(`  Stake[${i}]: amount=${Number(amount)/1e18} DIBS, releaseTime=${releaseTime}, lockDays=${lockDays}, apyRate=${apyRate}bps, claimed=${claimed}`);
          }
        } catch (e: any) {
          console.log(`  Stake[${i}]: ERROR - ${e?.shortMessage || e}`);
        }
      }
    }
  } catch (e: any) {
    console.log(`Owner stake count: ERROR - ${e?.shortMessage || e}`);
  }
  
  // ===============================================
  // PART 4: Check native USDC balance of V2
  // ===============================================
  console.log("\n═══ PART 4: V2 Native Balance ═══\n");
  try {
    const bal = await publicClient.getBalance({ address: V2 });
    console.log(`V2 native USDC balance: ${bal} (${Number(bal) / 1e18} USDC)`);
  } catch (e: any) {
    console.log(`ERROR: ${e?.shortMessage || e}`);
  }
  
  console.log("\n═══ DONE ═══");
}

main().catch(e => { console.error(e); process.exit(1); });
