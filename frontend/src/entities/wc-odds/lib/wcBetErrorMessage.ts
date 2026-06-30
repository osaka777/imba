const WC_BET_ERROR_RU: Record<string, string> = {
  "Odds unavailable for this outcome": "Приём ставок на этот исход закрыт",
  "This outcome is temporarily suspended": "Исход временно приостановлен",
  "Betting closed for this period": "Приём ставок на этот период закрыт",
  "Betting closed for this match": "Приём ставок на этот матч закрыт",
  "This market is not available for betting": "Этот рынок недоступен для ставок",
  "Insufficient funds": "Недостаточно средств на счёте",
  "Event not found": "Матч не найден",
  "Outcome required": "Не выбран исход",
  "Pick required for 1X2 market": "Выберите исход: П1, X или П2",
  "Odds have changed": "Коэффициент изменился",
};

const OUTCOME_CLOSED_ERRORS = new Set([
  "Odds unavailable for this outcome",
  "This outcome is temporarily suspended",
  "This market is not available for betting",
  "Betting closed for this match",
]);

export function formatWcBetErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Не удалось принять ставку";

  const exact = WC_BET_ERROR_RU[trimmed];
  if (exact) return exact;

  const stakeMatch = trimmed.match(/^Stake must be between ([\d.]+) and ([\d.]+)$/);
  if (stakeMatch) {
    const min = Number(stakeMatch[1]).toLocaleString("ru-RU");
    const max = Number(stakeMatch[2]).toLocaleString("ru-RU");
    return `Сумма ставки — от ${min} до ${max}`;
  }

  return trimmed;
}

export function isWcBetOutcomeClosedError(message: string): boolean {
  return OUTCOME_CLOSED_ERRORS.has(message.trim());
}
