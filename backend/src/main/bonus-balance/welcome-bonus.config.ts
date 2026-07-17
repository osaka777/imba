export interface WelcomeBonusConfig {
  minDeposit: number;
  maxBonus: number;
  bonusPercentage: number;
  wagerMultiplier: number;
  maxCashoutMultiplier: number;
  expiryHours: number;
}

const DEFAULT_WELCOME: WelcomeBonusConfig = {
  minDeposit: 10,
  maxBonus: 50,
  bonusPercentage: 40,
  wagerMultiplier: 8,
  maxCashoutMultiplier: 1.5,
  expiryHours: 24,
};

export const WELCOME_BONUS_CONFIG: Record<string, WelcomeBonusConfig> = {
  KZT: { minDeposit: 5000, maxBonus: 5000, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  RUB: { minDeposit: 2000, maxBonus: 3000, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  USD: { minDeposit: 10, maxBonus: 50, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  BRL: { minDeposit: 30, maxBonus: 150, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  TRY: { minDeposit: 500, maxBonus: 2500, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  USDT: { minDeposit: 30, maxBonus: 50, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  UAH: { minDeposit: 200, maxBonus: 1500, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  UZS: { minDeposit: 100000, maxBonus: 500000, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  AZN: { minDeposit: 20, maxBonus: 100, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  KGS: { minDeposit: 500, maxBonus: 2500, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
  TJS: { minDeposit: 100, maxBonus: 500, bonusPercentage: 40, wagerMultiplier: 8, maxCashoutMultiplier: 1.5, expiryHours: 24 },
};

export function getWelcomeBonusConfig(currencyCode: string): WelcomeBonusConfig {
  return WELCOME_BONUS_CONFIG[currencyCode.toUpperCase()] ?? DEFAULT_WELCOME;
}
