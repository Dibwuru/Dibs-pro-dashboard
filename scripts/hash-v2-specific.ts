import { toHex, keccak256 } from "viem";

const targetSelectors = ["43000823", "565b6040", "84828501", "e7f27b93"];

// Try to identify: dibsToken(), and V2-specific function names
const sigs = [
  // Token getter patterns (for 0x10c7a8e1)
  "dibsToken()",
  "token()",
  "getToken()",
  "DIBS()",
  "dibs()",
  "getDibs()",
  
  // Swap-like patterns (for 0x124f6d66 - reverts "Vault lacks native USDC liquidity")
  "swapDibsForUsdc(uint256)",
  "swapDibsForNative(uint256)",
  "swapDibsForEth(uint256)",
  "swapDibs(uint256)",
  "sellDibs(uint256)",
  "sell(uint256)",
  "exchangeDibs(uint256)",
  "convertDibs(uint256)",
  "redeemDibs(uint256)",
  "redeem(uint256)",
  "burnDibs(uint256)",
  "withdrawDibs(uint256)",
  "cashOut(uint256)",
  "swapDibsToUsdc(uint256)",
  "swapDibsToNative(uint256)",
  "dibsToUsdc(uint256)",
  "dibsToNative(uint256)",
  
  // Swap-like patterns (for 0xff02b394 - reverts "Must send USDC to swap")
  "swapUsdcForDibs()",
  "swapNativeForDibs()",
  "swapEthForDibs()",
  "buyDibs()",
  "mintDibs()",
  "purchaseDibs()",
  "exchangeUsdcForDibs()",
  "convertUsdcToDibs()",
  "swapNativeToDibs()",
  "swapUsdcToDibs()",
  "nativeToDibs()",
  "usdcToDibs()",
  
  // Admin/migration patterns (for remaining unknowns)
  "migrate(address)",
  "migrate(address,uint256)",
  "upgrade(address)",
  "upgradeTo(address)",
  "upgradeToAndCall(address,bytes)",
  "migrateTo(address)",
  "migrateVault(address)",
  "migrateFunds(address)",
  "migrateTokens(address)",
  "drain()",
  "drain(address)",
  "drain(address,uint256)",
  "drainTo(address)",
  "drainTokens(address)",
  "drainTokens(address,uint256)",
  "sweep()",
  "sweep(address)",
  "sweep(address,uint256)",
  "sweepAll(address)",
  "skim(address)",
  "skim(address,uint256)",
  "rescue()",
  "rescue(address)",
  "rescue(address,uint256)",
  "recover()",
  "recover(address)",
  "recover(address,uint256)",
  "withdrawAll()",
  "withdrawAll(address)",
  "withdrawAllTokens(address)",
  "emergencyWithdraw()",
  "emergencyWithdraw(address)",
  "emergencyWithdraw(address,uint256)",
  "emergencyExit()",
  "emergencyExit(address)",
  "emergencyStop()",
  "emergencyPause()",
  "pause()",
  "unpause()",
  "stop()",
  "shutdown()",
  "kill()",
  "destroy()",
  "selfdestruct()",
  
  // Vault-specific admin patterns
  "setToken(address)",
  "setDibs(address)",
  "setDibsToken(address)",
  "changeToken(address)",
  "initialize(address)",
  "init(address)",
  "configure(address)",
  "setup(address)",
  
  // Transfer patterns
  "transfer(address,uint256)",
  "adminTransfer(address,uint256)",
  "ownerTransfer(address,uint256)",
  "forceTransfer(address,uint256)",
  "manualTransfer(address,uint256)",
  
  // Rewards/claim patterns
  "claimRewards()",
  "claimAll()",
  "harvest()",
  "compound()",
  "reinvest()",
  
  // Force unstake
  "forceUnstake(address,uint256)",
  "adminUnstake(address,uint256)",
  "ownerUnstake(address,uint256)",
  "overrideUnstake(address,uint256)",
  
  // Governance
  "propose(address)",
  "execute(address)",
  "veto()",
  "cancel()",
  
  // Events (not functions, but PUSH4 can be for events too)
  // Actually events use LOG opcodes, not PUSH4 for dispatch
];

// Also add V2-specific naming: maybe the V2 uses different function names than V3
// If V3 = DibsSwapVault, V2 might be DibsStakeVault, DibsVault, etc
const v2Specific = [
  "dibsToken()",
  "swapToken()",
];

for (const s of v2Specific) sigs.push(s);

console.log(`Testing ${sigs.length} signatures against ${targetSelectors.length} remaining unknowns...\n`);

let matches = 0;
for (const sig of sigs) {
  const hash = keccak256(toHex(sig));
  const sel = hash.slice(2, 10);
  if (targetSelectors.includes(sel)) {
    console.log(`✅ MATCH: 0x${sel} => ${sig}`);
    matches++;
  }
  // Also check ALL 7 unknown selectors
  const allUnknowns = ["10c7a8e1", "124f6d66", "43000823", "565b6040", "84828501", "e7f27b93", "ff02b394"];
  if (allUnknowns.includes(sel)) {
    console.log(`✅ MATCH: 0x${sel} => ${sig}`);
    matches++;
  }
}

if (matches === 0) {
  console.log("No matches found.");
}
