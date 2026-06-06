/**
 * Truncates an Ethereum address to 0x1234...5678 format.
 * Returns empty string for invalid/short addresses to prevent UI overflow.
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address || "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
