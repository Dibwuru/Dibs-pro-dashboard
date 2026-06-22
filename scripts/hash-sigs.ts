import { toHex, keccak256 } from "viem";

// Systematically try common function signatures for token recovery
const candidates = [
  // Direct withdraw patterns
  "withdrawToken(address,uint256)",
  "withdrawToken(address)",
  "withdraw(uint256)",
  "withdraw()",
  "withdrawAll()",
  "withdrawERC20(address,uint256)",
  "withdrawERC20(address)",
  
  // Rescue/recover patterns
  "rescueToken(address,uint256)",
  "rescueToken(address)",
  "rescueTokens(address)",
  "recoverToken(address,uint256)",
  "recoverToken(address)",
  "recoverTokens(address)",
  
  // Sweep/drain patterns
  "sweepToken(address,uint256)",
  "sweepToken(address)",
  "sweepTokens(address)",
  "drainToken(address)",
  "drainTokens()",
  
  // Emergency patterns
  "emergencyWithdraw(address,uint256)",
  "emergencyWithdraw(address)",
  "emergencyWithdraw()",
  "emergencyExit()",
  "emergencyTokenTransfer(address,uint256)",
  
  // Owner patterns
  "retrieveToken(address,uint256)",
  "retrieveToken(address)",
  "pullTokens(address,uint256)",
  "pullTokens(address)",
  "extractToken(address,uint256)",
  "extractToken(address)",
  
  // Common owner admin patterns
  "claimTokens(address,uint256)",
  "claimTokens(address)",
  "claimToken(address)",
  "removeTokens(address,uint256)",
  "removeTokens(address)",
  
  // Exchange rate / admin
  "setExchangeRate(uint256)",
  "changeExchangeRate(uint256)",
  "updateRate(uint256)",
  
  // Transfer/admin
  "transferAnyERC20Token(address,uint256)",
  "transferAnyToken(address,uint256)",
  "transferToken(address,uint256)",
  
  // Fund/liquidity
  "fund(uint256)",
  "addLiquidity(uint256)",
  "deposit(uint256)",
  "depositToken(address,uint256)",
  
  // Pause
  "pause()",
  "unpause()",
  
  // Ownership
  "renounceOwnership()",
  "transferOwnership(address)",
];

console.log("=== Searching for matches with unknown V2 selectors ===");
console.log("Format: selector => signature\n");

for (const sig of candidates) {
  const hash = keccak256(toHex(sig));
  const selector = hash.slice(0, 10); // 0x + 8 hex chars
  console.log(`${selector} => ${sig}`);
}
