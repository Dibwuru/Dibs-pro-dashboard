import { createPublicClient, http, defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

const DIBS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";
const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7";
const V3 = "0xc45073b9de74c7f286c2545a618b703f31228cb6";

async function main() {
  const balanceOfABI = [{
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }];

  for (const [label, addr] of [["V2 Vault", V2], ["V3 Vault", V3]]) {
    try {
      const bal = await client.readContract({
        address: DIBS as `0x${string}`,
        abi: balanceOfABI,
        functionName: "balanceOf",
        args: [addr as `0x${string}`],
      });
      const formatted = Number(bal) / 1e18;
      console.log(`${label} (${addr}): ${bal} raw = ${formatted.toLocaleString()} DIBS`);
    } catch (e: any) {
      console.log(`${label} (${addr}): ERROR - ${e?.shortMessage || e?.message || e}`);
    }
  }

  // Owner address from deploy script
  const owner = "0x74C125c7bCDb56aC3CF95dBeA16f38Dbfaf5C4ee";
  try {
    const bal = await client.readContract({
      address: DIBS as `0x${string}`,
      abi: balanceOfABI,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    });
    const formatted = Number(bal) / 1e18;
    console.log(`Owner (${owner}): ${bal} raw = ${formatted.toLocaleString()} DIBS`);
  } catch (e: any) {
    console.log(`Owner (${owner}): ERROR - ${e?.shortMessage || e?.message || e}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
