/** Shared totals group-name detection for BetAPI and WC market blocks. */
export function isTotalsGroupName(name?: string): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  if (!lower) return false;
  if (/чет|нечет|even|odd/i.test(lower)) return false;
  return lower === "тотал" || lower === "total" || lower.includes("тотал");
}
