import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

// Arc Testnet chain definition
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://arc-testnet.drpc.org"] } },
});

const DIBS_TOKEN_ADDRESS = "0x2b0ec237e5Cf460962E3eDe88cb676d83C807912";

async function main() {
  // Read private key silently from .env
  const envPath = "/root/my-ai-project/.env";
  const envContent = fs.readFileSync(envPath, "utf-8");
  // Parse .env line by line, skipping comments
  let privateKey: string | null = null;
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;
    const match = trimmed.match(/^PRIVATE_KEY\s*=\s*(0x[a-fA-F0-9]+)/);
    if (match) {
      privateKey = match[1];
      break;
    }
  }
  if (!privateKey) {
    throw new Error("Could not find PRIVATE_KEY in .env file");
  }
  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    throw new Error(`Invalid private key format: length=${privateKey.length}`);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  // Build directory - read ABI and bytecode
  const projectRoot = path.resolve(__dirname, "..");
  const buildDir = path.join(projectRoot, "build");
  const abi = JSON.parse(
    fs.readFileSync(path.join(buildDir, "DibsSwapVault_sol_DibsSwapVault.abi"), "utf-8")
  );
  const bytecode = ("0x" +
    fs.readFileSync(path.join(buildDir, "DibsSwapVault_sol_DibsSwapVault.bin"), "utf-8").trim()) as `0x${string}`;

  // Create clients
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  console.log(`Deployer address: ${account.address}`);

  // Deploy the contract
  console.log("Deploying DibsSwapVault to Arc Testnet...");
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [DIBS_TOKEN_ADDRESS],
  });

  console.log(`Transaction hash: ${hash}`);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  if (!contractAddress) {
    throw new Error("Contract address not found in receipt");
  }

  console.log(`\n========================================`);
  console.log(`✅ DibsSwapVault deployed successfully!`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`========================================\n`);

  // Write to swap_vault_meta.txt
  const metaPath = path.join(__dirname, "swap_vault_meta.txt");
  const metaContent = `DibsSwapVault Contract Address: ${contractAddress}
Deployer: ${account.address}
Transaction Hash: ${hash}
Network: Arc Testnet (Chain ID: 5042002)
DIBS Token: ${DIBS_TOKEN_ADDRESS}
`;
  fs.writeFileSync(metaPath, metaContent);
  console.log(`Address written to swap_vault_meta.txt`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
