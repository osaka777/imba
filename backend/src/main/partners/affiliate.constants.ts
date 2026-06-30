export const AFFILIATE_HOLD_DAYS = 7;

export const AFFILIATE_MIN_WITHDRAW: Record<string, number> = {
  KZT: 15000,
  USD: 50,
  RUB: 3000,
  UAH: 1000,
  EUR: 50,
  TRY: 500,
  UZS: 500000,
};

export const AFFILIATE_DEFAULT_MIN_WITHDRAW = 50;

/** Макс. активных промокодов, которые партнёр может создать сам */
export const PARTNER_SELF_PROMO_MAX_ACTIVE = 10;

/** Макс. активаций на один self-service промокод */
export const PARTNER_SELF_PROMO_MAX_USES = 500;

/** Срок действия self-service промо (дней) */
export const PARTNER_SELF_PROMO_VALID_DAYS = 90;

/** Дефолтный CPA если не задан в админке */
export const AFFILIATE_DEFAULT_CPA: Record<string, number> = {
  KZT: 15000,
  USD: 50,
  RUB: 3000,
};

export function getAffiliateMinWithdraw(currencyCode: string): number {
  return AFFILIATE_MIN_WITHDRAW[currencyCode.toUpperCase()] ?? AFFILIATE_DEFAULT_MIN_WITHDRAW;
}

export function getDefaultCpaPayout(currencyCode: string): number {
  return AFFILIATE_DEFAULT_CPA[currencyCode.toUpperCase()] ?? AFFILIATE_DEFAULT_MIN_WITHDRAW;
}
