import { createPublicClient, http, defineChain } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7";
const V3 = "0xc45073b9de74c7f286c2545a618b703f31228cb6";

const ownerABI = [{ inputs: [], name: "owner", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" }];
const erABI = [{ inputs: [], name: "exchangeRate", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" }];

async function main() {
  for (const [label, addr] of [["V2", V2], ["V3", V3]]) {
    try {
      const o = await client.readContract({ address: addr as `0x${string}`, abi: ownerABI, functionName: "owner" });
      console.log(`${label} owner: ${o}`);
    } catch (e: any) { console.log(`${label} owner: ERROR - ${e?.shortMessage || e?.message || e}`); }
    
    try {
      const r = await client.readContract({ address: addr as `0x${string}`, abi: erABI, functionName: "exchangeRate" });
      console.log(`${label} exchangeRate: ${r}`);
    } catch (e: any) { console.log(`${label} exchangeRate: ERROR - ${e?.shortMessage || e?.message || e}`); }
  }
  
  // Also check the .env for which address the deployer has
  console.log("\n--- Checking deploy script owner ---");
  const fs = require("fs");
  const envPath = "/root/my-ai-project/.env";
  const env = fs.readFileSync(envPath, "utf-8");
  const lines = env.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("#") || line.trim() === "") continue;
    console.log(line.trim());
  }
}

main().catch(e => { console.error(e); process.exit(1); });
