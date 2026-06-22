import { createPublicClient, http, defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

const OWNER = "0x979Bd52451C723456Df1EBEF8a0Ee197765Df294" as `0x${string}`;
const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7" as `0x${string}`;
const V3 = "0xc45073b9de74c7f286c2545a618b703f31228cb6" as `0x${string}`;

async function main() {
  console.log("═══ Native USDC Balances ═══\n");
  
  for (const [label, addr] of [["Owner", OWNER], ["V2 Vault", V2], ["V3 Vault", V3]]) {
    try {
      const bal = await client.getBalance({ address: addr });
      const formatted = Number(bal) / 1e18;
      console.log(`${label} (${addr}): ${bal} = ${formatted.toLocaleString()} USDC`);
    } catch (e: any) {
      console.log(`${label}: ERROR - ${e?.shortMessage || e}`);
    }
  }
  
  // Also check DIBS balance of owner
  console.log("\n═══ DIBS Balances ═══\n");
  const balanceOfABI = [{
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }];
  
  const DIBS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912" as `0x${string}`;
  
  for (const [label, addr] of [["Owner", OWNER]]) {
    try {
      const bal = await client.readContract({
        address: DIBS,
        abi: balanceOfABI,
        functionName: "balanceOf",
        args: [addr],
      });
      const formatted = Number(bal) / 1e18;
      console.log(`${label} DIBS: ${bal} = ${formatted.toLocaleString()} DIBS`);
    } catch (e: any) {
      console.log(`${label} DIBS: ERROR - ${e?.shortMessage || e}`);
    }
  }
  
  // Check total DIBS supply
  console.log("\n═══ Total DIBS Supply ═══\n");
  try {
    const totalSupplyABI = [{
      inputs: [],
      name: "totalSupply",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }];
    const supply = await client.readContract({
      address: DIBS,
      abi: totalSupplyABI,
      functionName: "totalSupply",
    });
    console.log(`Total DIBS supply: ${supply} = ${(Number(supply) / 1e18).toLocaleString()} DIBS`);
  } catch (e: any) {
    console.log(`Total supply: ERROR - ${e?.shortMessage || e}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
