import type { MessageKey, TranslateParams } from "~/shared/i18n/messages";

export function getBonusRemainingMs(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).getTime() - Date.now();
}

export function isBonusExpired(expiresAt?: string | null): boolean {
  const remaining = getBonusRemainingMs(expiresAt);
  return remaining !== null && remaining <= 0;
}

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

export function formatBonusTimeLeft(
  expiresAt?: string | null,
  t?: TranslateFn,
): string | null {
  const remaining = getBonusRemainingMs(expiresAt);
  if (remaining === null) return null;
  if (remaining <= 0) return t ? t("promo.timeExpired") : "истёк";

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return t
      ? t("promo.timeHoursMins", { hours, minutes })
      : `${hours} ч ${minutes} мин`;
  }
  return t ? t("promo.timeMins", { minutes }) : `${minutes} мин`;
}

export function getWagerProgressPercent(
  totalWagered?: string | number | null,
  requiredWager?: string | number | null,
): number {
  const wagered = Number(totalWagered ?? 0);
  const required = Number(requiredWager ?? 0);
  if (!Number.isFinite(required) || required <= 0) return 0;
  return Math.min(100, Math.round((wagered / required) * 100));
}
