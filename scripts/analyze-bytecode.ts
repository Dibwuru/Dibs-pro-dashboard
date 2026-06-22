import { createPublicClient, http, defineChain } from "viem";
import { getBytecode } from "viem/actions";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });
const V2 = "0xbe84da0258c1c6143553c33801da9c5f9584e5b7";

const KNOWN: Record<string, string> = {
  "a9059cbb": "transfer(address,uint256)",
  "095ea7b3": "approve(address,uint256)",
  "70a08231": "balanceOf(address)",
  "dd62ed3e": "allowance(address,address)",
  "23b872dd": "transferFrom(address,address,uint256)",
  "8da5cb5b": "owner()",
  "f2fde38b": "transferOwnership(address)",
  "715018a6": "renounceOwnership()",
  "8456cb59": "pause()",
  "3f4ba83a": "unpause()",
  "42966c68": "burn(uint256)",
  "40c10f19": "mint(address,uint256)",
  "2e1a7d4d": "withdraw(uint256)",
  "439370b1": "withdrawToken(address,uint256)",
  "01e33667": "rescueToken(address,uint256)",
  "3e5aa082": "rescueTokens(address,uint256)",
  "9e281a98": "withdrawERC20(address,uint256)",
  "29b2cb2e": "recoverToken(address,uint256)",
  "d0e30db0": "deposit()",
  "1a804049": "swapUsdcForDibs()",
  "25e68e46": "swapDibsForUsdc(uint256)",
  "7b0472f0": "stake(uint256,uint256)",
  "2e17de78": "unstake(uint256)",
  "d06ca61f": "setExchangeRate(uint256)",
  "1ad3299a": "getUserStakesCount(address)",
  "baa9e56e": "userStakes(address,uint256)",
  "79cc6790": "burnFrom(address,uint256)",
};

async function main() {
  console.log(`V2 contract: ${V2}\n`);
  const bc = await getBytecode(client, { address: V2 as `0x${string}` });
  if (!bc || bc === "0x") { console.log("NO BYTECODE"); return; }
  
  console.log(`Bytecode: ${bc.length - 2} hex chars (${(bc.length - 2) / 2} bytes)\n`);

  // Extract all PUSH4 patterns
  const re = /63([0-9a-f]{8})/gi;
  const seen = new Set<string>();
  let m;
  while ((m = re.exec(bc)) !== null) seen.add(m[1].toLowerCase());
  
  const sorted = [...seen].sort();
  
  console.log("=== KNOWN SELECTORS ===");
  for (const s of sorted) {
    if (KNOWN[s]) console.log(`  0x${s} => ${KNOWN[s]}`);
  }
  
  console.log("\n=== UNKNOWN SELECTORS (potential custom functions) ===");
  for (const s of sorted) {
    if (!KNOWN[s]) console.log(`  0x${s}`);
  }
  
  // Specifically check for recovery functions
  console.log("\n=== RECOVERY FUNCTION CHECK ===");
  const recoverySelectors = ["01e33667", "3e5aa082", "9e281a98", "29b2cb2e", "439370b1"];
  for (const r of recoverySelectors) {
    const name = KNOWN[r] || r;
    console.log(`  ${bc.includes(r) ? '✅' : '❌'} ${name} (0x${r})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
