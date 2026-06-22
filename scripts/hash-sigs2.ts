import { toHex, keccak256 } from "viem";

const targetSelectors = ["10c7a8e1", "124f6d66", "43000823", "565b6040", "84828501", "e7f27b93", "ff02b394"];

// Massive list of possible function signatures
const signatures: string[] = [];

// Common verb + noun patterns
const verbs = ["", "emergency", "admin", "owner", "force", "manual", "direct", "token"];
const nouns = ["Withdraw", "Rescue", "Recover", "Sweep", "Drain", "Pull", "Extract", "Claim", "Retrieve", "Remove", "Transfer", "Send", "Move", "Release", "Free", "Redeem"];
const suffixes = ["Token", "Tokens", "Funds", "Balance", "All", "ERC20", "Asset", "Assets", "Stake", "Liquidity"];

for (const verb of verbs) {
  for (const noun of nouns) {
    for (const suffix of suffixes) {
      const name = verb + noun + suffix;
      // No args
      signatures.push(name + "()");
      // address
      signatures.push(name + "(address)");
      // address,uint256
      signatures.push(name + "(address,uint256)");
      // uint256
      signatures.push(name + "(uint256)");
    }
  }
}

// Compound patterns
const compounds = [
  "withdrawToken", "rescueToken", "recoverToken", "sweepToken", 
  "drainToken", "pullToken", "extractToken", "claimToken",
  "retrieveToken", "removeToken", "transferToken", "sendToken",
  "moveToken", "releaseToken", "freeToken", "redeemToken",
  "withdrawTokens", "rescueTokens", "recoverTokens", "sweepTokens",
  "withdrawERC20", "rescueERC20", "recoverERC20",
  "tokenFallback", "onTokenTransfer", "tokensReceived",
];

for (const c of compounds) {
  signatures.push(c + "()");
  signatures.push(c + "(address)");
  signatures.push(c + "(address,uint256)");
  signatures.push(c + "(uint256)");
  signatures.push(c + "(address,address,uint256)");
}

// Swap-like functions
const swapPatterns = [
  "swap", "swapExactTokensForTokens", "swapTokensForExactTokens",
  "swapExactETHForTokens", "swapExactTokensForETH",
  "deposit", "withdraw", "addLiquidity", "removeLiquidity",
  "swapForDibs", "swapForUsdc", "swapDibs", "swapUsdc",
  "buyDibs", "sellDibs", "exchangeDibs", "convertDibs",
];

for (const p of swapPatterns) {
  signatures.push(p + "()");
  signatures.push(p + "(uint256)");
  signatures.push(p + "(address,uint256)");
  signatures.push(p + "(uint256,uint256)");
}

// Stake/unstake variants
const stakePatterns = [
  "stake", "unstake", "withdrawStake", "claimReward", "claimRewards",
  "compound", "reinvest", "restake", "exit", "forceUnstake",
  "emergencyUnstake", "adminUnstake", "unstakeAll", "withdrawAll",
  "harvestRewards", "getReward", "collectReward",
];

for (const p of stakePatterns) {
  signatures.push(p + "()");
  signatures.push(p + "(uint256)");
  signatures.push(p + "(address,uint256)");
  signatures.push(p + "(uint256,uint256)");
}

// Ownership/admin patterns
const adminPatterns = [
  "renounceOwnership", "transferOwnership", "acceptOwnership",
  "setOwner", "changeOwner", "updateOwner",
  "pause", "unpause", "togglePause",
  "kill", "selfdestruct", "destroy",
  "migrate", "upgrade", "initialize",
  "setExchangeRate", "updateExchangeRate", "changeRate",
  "setFee", "updateFee", "setTreasury",
  "fund", "refill", "topUp", "addFunds",
  "donate", "contribute", "inject",
];

for (const p of adminPatterns) {
  signatures.push(p + "()");
  signatures.push(p + "(uint256)");
  signatures.push(p + "(address,uint256)");
  signatures.push(p + "(address)");
}

// V2-specific patterns (could be anything)
for (const p of ["v2Migrate", "migrateV2", "upgradeV2", "migrateToV3", "upgradeToV3"]) {
  signatures.push(p + "()");
  signatures.push(p + "(address)");
  signatures.push(p + "(address,uint256)");
}

console.log(`Testing ${signatures.length} signatures against ${targetSelectors.length} targets...\n`);

const seen = new Set<string>();
let matches = 0;
let total = 0;

for (const sig of signatures) {
  total++;
  const hash = keccak256(toHex(sig));
  const sel = hash.slice(2, 10); // without 0x prefix
  if (targetSelectors.includes(sel)) {
    console.log(`✅ MATCH: 0x${sel} => ${sig}`);
    matches++;
  }
}

console.log(`\nTotal signatures tested: ${total}`);
console.log(`Matches found: ${matches}`);

if (matches === 0) {
  console.log("\nNo matches. The unknown selectors may use custom/proprietary naming.");
}
