import { createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

const envContent = fs.readFileSync("/root/my-ai-project/.env", "utf-8");
let privateKey: string | null = null;
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed === "") continue;
  const match = trimmed.match(/^PRIVATE_KEY\s*=\s*(0x[a-fA-F0-9]+)/);
  if (match) { privateKey = match[1]; break; }
}

if (!privateKey) { console.log("ERROR: No PRIVATE_KEY found"); process.exit(1); }

const account = privateKeyToAccount(privateKey as `0x${string}`);
console.log(`Derived address: ${account.address}`);

const OWNER = "0x979Bd52451C723456Df1EBEF8a0Ee197765Df294";
console.log(`Owner address:   ${OWNER}`);
console.log(`Match: ${account.address.toLowerCase() === OWNER.toLowerCase() ? "✅ YES - you control both vaults!" : "❌ NO - different address"}`);
