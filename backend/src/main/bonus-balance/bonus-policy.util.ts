export interface PromoBonusPolicy {
  wagerMultiplier: number;
  wagerOnDepositPlusBonus: boolean;
  minDeposit: number;
  maxBonusAmount: number;
  maxCashoutMultiplier: number;
  requiresDeposit: boolean;
  bonusPercentage: number;
  fixedAmount: number;
}

export const DEFAULT_WAGER_MULTIPLIER = 6;
export const DEFAULT_MAX_CASHOUT_MULTIPLIER = 2;

export const DEFAULT_PROMO_BONUS_POLICY: PromoBonusPolicy = {
  wagerMultiplier: DEFAULT_WAGER_MULTIPLIER,
  wagerOnDepositPlusBonus: true,
  minDeposit: 0,
  maxBonusAmount: 0,
  maxCashoutMultiplier: DEFAULT_MAX_CASHOUT_MULTIPLIER,
  requiresDeposit: false,
  bonusPercentage: 0,
  fixedAmount: 0,
};

export function parsePromoBonusPolicy(
  value: unknown,
  promoType: string,
): PromoBonusPolicy {
  const raw = value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};

  const policy: PromoBonusPolicy = {
    ...DEFAULT_PROMO_BONUS_POLICY,
    wagerMultiplier: Number(raw.wagerMultiplier ?? DEFAULT_WAGER_MULTIPLIER) || DEFAULT_WAGER_MULTIPLIER,
    wagerOnDepositPlusBonus: raw.wagerOnDepositPlusBonus !== false,
    minDeposit: Number(raw.minDeposit ?? 0) || 0,
    maxBonusAmount: Number(raw.maxBonusAmount ?? 0) || 0,
    maxCashoutMultiplier: Number(
      raw.maxCashoutMultiplier ?? DEFAULT_MAX_CASHOUT_MULTIPLIER,
    ) || DEFAULT_MAX_CASHOUT_MULTIPLIER,
    requiresDeposit: raw.requiresDeposit === true,
    bonusPercentage: Number(raw.percentage ?? 0) || 0,
    fixedAmount: Number(raw.amount ?? 0) || 0,
  };

  if (promoType === 'DEPOSIT_BONUS') {
    policy.requiresDeposit = true;
    if (!policy.bonusPercentage) {
      policy.bonusPercentage = 50;
    }
  }

  if (promoType === 'FREE_BET') {
    policy.wagerOnDepositPlusBonus = false;
    policy.fixedAmount = Number(raw.amount ?? 0) || 0;
    policy.wagerMultiplier = Number(raw.wagerMultiplier ?? 3) || 3;
  }

  if (raw.requiresDeposit === true) {
    policy.requiresDeposit = true;
  }

  return policy;
}

export function calcDepositBonusAmount(
  depositAmount: number,
  policy: PromoBonusPolicy,
): number {
  let bonus = policy.fixedAmount;
  if (policy.bonusPercentage > 0) {
    bonus = depositAmount * (policy.bonusPercentage / 100);
  }
  if (policy.maxBonusAmount > 0) {
    bonus = Math.min(bonus, policy.maxBonusAmount);
  }
  return roundMoney(Math.max(0, bonus));
}

export function calcRequiredWager(
  depositAmount: number,
  bonusAmount: number,
  policy: PromoBonusPolicy,
): number {
  const base = policy.wagerOnDepositPlusBonus
    ? depositAmount + bonusAmount
    : bonusAmount;
  return roundMoney(base * policy.wagerMultiplier);
}

export function calcMaxCashout(
  depositAmount: number,
  policy: PromoBonusPolicy,
): number | null {
  if (policy.maxCashoutMultiplier <= 0 || depositAmount <= 0) {
    return null;
  }
  return roundMoney(depositAmount * policy.maxCashoutMultiplier);
}

export function getWelcomeBonusDisplayAmount(
  policy: PromoBonusPolicy,
  promoValue: unknown,
): number {
  if (policy.maxBonusAmount > 0) {
    return policy.maxBonusAmount;
  }
  const raw = promoValue && typeof promoValue === 'object'
    ? (promoValue as Record<string, unknown>)
    : {};
  return Number(raw.amount ?? 0) || 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
