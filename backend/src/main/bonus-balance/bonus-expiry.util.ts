export const BONUS_EXPIRY_HOURS = 24;

export function buildBonusExpiresAt(hours = BONUS_EXPIRY_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function isBonusExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}

export function getBonusRemainingMs(expiresAt: Date | null | undefined): number {
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt.getTime() - Date.now());
}
