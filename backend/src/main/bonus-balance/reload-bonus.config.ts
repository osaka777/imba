export interface ReloadBonusTier {
  depositOrdinal: number;
  bonusPercentage: number;
  maxBonus: number;
  wagerMultiplier: number;
  expiryHours: number;
}

const DEFAULT_RELOAD: ReloadBonusTier[] = [
  { depositOrdinal: 2, bonusPercentage: 20, maxBonus: 40, wagerMultiplier: 8, expiryHours: 24 },
  { depositOrdinal: 3, bonusPercentage: 10, maxBonus: 25, wagerMultiplier: 8, expiryHours: 24 },
];

const RELOAD_BY_CURRENCY: Record<string, ReloadBonusTier[]> = {
  KZT: [
    { depositOrdinal: 2, bonusPercentage: 20, maxBonus: 2500, wagerMultiplier: 8, expiryHours: 24 },
    { depositOrdinal: 3, bonusPercentage: 10, maxBonus: 1500, wagerMultiplier: 8, expiryHours: 24 },
  ],
  RUB: [
    { depositOrdinal: 2, bonusPercentage: 20, maxBonus: 1500, wagerMultiplier: 8, expiryHours: 24 },
    { depositOrdinal: 3, bonusPercentage: 10, maxBonus: 1000, wagerMultiplier: 8, expiryHours: 24 },
  ],
  USD: DEFAULT_RELOAD,
  USDT: DEFAULT_RELOAD,
  BRL: [
    { depositOrdinal: 2, bonusPercentage: 20, maxBonus: 80, wagerMultiplier: 8, expiryHours: 24 },
    { depositOrdinal: 3, bonusPercentage: 10, maxBonus: 50, wagerMultiplier: 8, expiryHours: 24 },
  ],
  TRY: [
    { depositOrdinal: 2, bonusPercentage: 20, maxBonus: 1200, wagerMultiplier: 8, expiryHours: 24 },
    { depositOrdinal: 3, bonusPercentage: 10, maxBonus: 800, wagerMultiplier: 8, expiryHours: 24 },
  ],
};

export function getReloadBonusTier(
  currencyCode: string,
  depositOrdinal: number,
): ReloadBonusTier | null {
  const tiers = RELOAD_BY_CURRENCY[currencyCode.toUpperCase()] ?? DEFAULT_RELOAD;
  return tiers.find((t) => t.depositOrdinal === depositOrdinal) ?? null;
}
