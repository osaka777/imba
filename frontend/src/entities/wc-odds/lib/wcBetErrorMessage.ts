import type { AppLocale } from "~/shared/i18n/locale";
import { toIntlLocale } from "~/shared/i18n/format";
import { translate } from "~/shared/i18n/messages";

const WC_BET_ERROR_KEYS: Record<string, Parameters<typeof translate>[1]> = {
  "Odds unavailable for this outcome": "coupon.wcOutcomeClosed",
  "This outcome is temporarily suspended": "coupon.wcOutcomeSuspended",
  "Betting closed for this period": "coupon.wcPeriodClosed",
  "Betting closed for this match": "coupon.wcMatchClosed",
  "This market is not available for betting": "coupon.wcMarketUnavailable",
  "Insufficient funds": "coupon.wcInsufficientFunds",
  "Event not found": "coupon.wcEventNotFound",
  "Outcome required": "coupon.wcOutcomeRequired",
  "Pick required for 1X2 market": "coupon.wcPickRequired",
  "Odds have changed": "coupon.wcOddsChanged",
};

const OUTCOME_CLOSED_ERRORS = new Set([
  "Odds unavailable for this outcome",
  "This outcome is temporarily suspended",
  "This market is not available for betting",
  "Betting closed for this match",
]);

export function formatWcBetErrorMessage(
  message: string,
  locale: AppLocale = "ru",
): string {
  const trimmed = message.trim();
  if (!trimmed) return translate(locale, "coupon.wcBetFailed");

  const key = WC_BET_ERROR_KEYS[trimmed];
  if (key) return translate(locale, key);

  const stakeMatch = trimmed.match(/^Stake must be between ([\d.]+) and ([\d.]+)$/);
  if (stakeMatch) {
    const intl = toIntlLocale(locale);
    const min = Number(stakeMatch[1]).toLocaleString(intl);
    const max = Number(stakeMatch[2]).toLocaleString(intl);
    return translate(locale, "coupon.wcStakeRange", { min, max });
  }

  return trimmed;
}

export function isWcBetOutcomeClosedError(message: string): boolean {
  return OUTCOME_CLOSED_ERRORS.has(message.trim());
}
