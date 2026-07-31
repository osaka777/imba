export type OddsAcceptMode = "never" | "increase" | "always";

export const ODDS_ACCEPT_MODE_KEY = "couponOddsAcceptMode";
export const DEFAULT_ODDS_ACCEPT_MODE: OddsAcceptMode = "increase";

export function isOddsAcceptMode(value: unknown): value is OddsAcceptMode {
  return value === "never" || value === "increase" || value === "always";
}

/** First request: always → accept any drift; otherwise pin clientOdds. */
export function shouldSendAcceptOddsChange(mode: OddsAcceptMode): boolean {
  return mode === "always";
}

/**
 * After a `coefficientChanged` rejection — retry only when the mode allows it.
 * `increase` needs both prices so we know the new quote is not worse for the player.
 */
export function shouldRetryAfterOddsChange(
  mode: OddsAcceptMode,
  original?: number | null,
  actual?: number | null,
): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  if (
    original == null
    || actual == null
    || !Number.isFinite(original)
    || !Number.isFinite(actual)
  ) {
    return false;
  }
  return actual + 1e-9 >= original;
}
