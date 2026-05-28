/**
 * Check if a smart contract is deployed on the Arc Testnet.
 *
 * Usage:
 *   npx tsx scripts/check-contract.ts [CONTRACT_ADDRESS]
 *
 * Example:
 *   npx tsx scripts/check-contract.ts 0x1234567890abcdef1234567890abcdef12345678
 *
 * If no address is provided as a CLI argument, update the CONTRACT_ADDRESS constant below.
 */

import { createPublicClient, http, defineChain } from "viem";
import { getBytecode } from "viem/actions";

// ============================================================================
// CONFIGURATION — update this address to the dibscoin contract you want to check
// ============================================================================
const CONTRACT_ADDRESS = process.argv[2] || "0x_YOUR_CONTRACT_ADDRESS_HERE";

// Arc Testnet chain definition (mirrors Web3Provider.tsx config)
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://testnet.explorer.arc.network",
    },
  },
  testnet: true,
});

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// ============================================================================
// HELPERS
// ============================================================================

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function formatBytecodePreview(code: string): string {
  if (code.length <= 66) return code;
  return `${code.slice(0, 34)}...${code.slice(-32)} (${code.length - 2} hex chars / ${(code.length - 2) / 2} bytes)`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Arc Testnet — Contract Deployment Check");
  console.log("═══════════════════════════════════════════════════════\n");

  // Validate address
  if (!isValidAddress(CONTRACT_ADDRESS)) {
    console.error(
      `❌ Invalid address: "${CONTRACT_ADDRESS}"\n` +
        `   Expected format: 0x followed by 40 hex characters (0x[a-fA-F0-9]{40})\n\n` +
        `   Usage: npx tsx scripts/check-contract.ts 0x<contract-address>\n` +
        `   Or update the CONTRACT_ADDRESS constant in the script.\n`
    );
    process.exit(1);
  }

  console.log(`📋 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network:          Arc Testnet (chain ID: ${arcTestnet.id})`);
  console.log(`🔗 RPC:              ${arcTestnet.rpcUrls.default.http[0]}`);
  console.log(`🔍 Explorer:         ${arcTestnet.blockExplorers.default.url}/address/${CONTRACT_ADDRESS}`);
  console.log("");

  try {
    // Fetch bytecode via eth_getCode
    console.log("⏳ Fetching on-chain bytecode...");
    const bytecode = await getBytecode(client, { address: CONTRACT_ADDRESS as `0x${string}` });

    const isDeployed = bytecode !== undefined && bytecode !== "0x";

    console.log("");
    console.log("═══════════════════════════════════════════════════════");
    if (isDeployed) {
      console.log("  ✅ CONTRACT IS DEPLOYED");
      console.log("═══════════════════════════════════════════════════════");
      console.log(`\n  Bytecode length: ${bytecode.length - 2} hex chars (${(bytecode.length - 2) / 2} bytes)`);
      console.log(`  Preview: ${formatBytecodePreview(bytecode)}`);
    } else {
      console.log("  ❌ CONTRACT IS NOT DEPLOYED");
      console.log("═══════════════════════════════════════════════════════");
      console.log(`\n  The address returned no bytecode ("${typeof bytecode === 'string' ? (bytecode || '0x') : 'empty'}").`);
      console.log("  This means no contract exists at this address on Arc Testnet.");
    }
    console.log("");
    console.log(`  Explorer: ${arcTestnet.blockExplorers.default.url}/address/${CONTRACT_ADDRESS}`);
    console.log("");

    process.exit(isDeployed ? 0 : 1);
  } catch (error) {
    console.error("\n❌ RPC call failed:");
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\nTroubleshooting tips:\n" +
        "  • Check that the RPC endpoint is reachable\n" +
        "  • Verify the contract address format is correct\n" +
        "  • Try again — the node may be temporarily unavailable\n"
    );
    process.exit(2);
  }
}

main();
