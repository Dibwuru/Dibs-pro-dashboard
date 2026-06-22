import { createPublicClient, http, defineChain, toHex, keccak256, encodeFunctionData, decodeFunctionResult } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7" as `0x${string}`;
const OWNER = "0x979Bd52451C723456Df1EBEF8a0Ee197765Df294" as `0x${string}`;
const DIBS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912" as `0x${string}`;

// Unknown selectors from V2
const unknownSelectors = [
  "0x10c7a8e1",
  "0x124f6d66",
  "0x43000823",
  "0x565b6040",
  "0x84828501",
  "0xe7f27b93",
  "0xff02b394",
];

async function tryCall(selector: string, data: `0x${string}`, label: string): Promise<string> {
  try {
    const result = await client.call({
      to: V2,
      data,
      account: OWNER, // simulate as owner
    });
    if (result.data && result.data !== "0x") {
      return `✅ SUCCESS - returned: ${result.data} (${result.data.length - 2} hex chars)`;
    }
    return `✅ SUCCESS - returned: ${result.data || "0x"} (no data)`;
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || String(e);
    // Only show first 100 chars of error
    return `❌ REVERT - ${msg.slice(0, 120)}`;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   ETH_CALL PROBING OF UNKNOWN V2 SELECTORS          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`V2: ${V2}`);
  console.log(`Owner: ${OWNER}\n`);

  for (const sel of unknownSelectors) {
    console.log(`─── Testing ${sel} ───`);
    
    // Pattern 1: no args
    let r = await tryCall(sel, sel as `0x${string}`, "no args");
    console.log(`  (no args): ${r}`);
    
    // Pattern 2: address arg (token address)
    const withAddr = (sel + "000000000000000000000000" + DIBS.slice(2)) as `0x${string}`;
    r = await tryCall(sel, withAddr, "address arg");
    console.log(`  (address): ${r}`);
    
    // Pattern 3: address + uint256 (token + amount = 500k DIBS ~ 5e23 wei)
    const amountHex = (500000n * 10n**18n).toString(16).padStart(64, "0");
    const withAddrAmt = (sel + "000000000000000000000000" + DIBS.slice(2) + amountHex) as `0x${string}`;
    r = await tryCall(sel, withAddrAmt, "address+uint256");
    console.log(`  (addr+amt): ${r}`);
    
    // Pattern 4: uint256 arg
    const withAmt = (sel + amountHex) as `0x${string}`;
    r = await tryCall(sel, withAmt, "uint256");
    console.log(`  (uint256): ${r}`);
    
    // Pattern 5: address + address (token + recipient)
    const withTwoAddr = (sel + "000000000000000000000000" + DIBS.slice(2) + "000000000000000000000000" + OWNER.slice(2)) as `0x${string}`;
    r = await tryCall(sel, withTwoAddr, "address+address");
    console.log(`  (addr+addr): ${r}`);
    
    // Pattern 6: uint256 + uint256 (e.g. stake amount + lockDays)
    const lockHex = (90).toString(16).padStart(64, "0");
    const withTwoAmt = (sel + amountHex.slice(0, 64) + lockHex) as `0x${string}`;
    r = await tryCall(sel, withTwoAmt, "uint256+uint256");
    console.log(`  (uint+uint): ${r}`);
    
    console.log("");
  }
  
  // Also try: call V2.owner() to confirm owner
  console.log("─── Verification ───");
  try {
    const ownerData = "0x8da5cb5b" as `0x${string}`;
    const r = await client.call({ to: V2, data: ownerData });
    console.log(`owner(): ${r.data}`);
  } catch (e: any) {
    console.log(`owner(): ERROR - ${e?.shortMessage || e}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
