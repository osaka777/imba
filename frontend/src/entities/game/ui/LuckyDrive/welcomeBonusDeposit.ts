import { getWelcomeLimit } from "./welcomeBonusLimits";

export const WELCOME_DEPOSIT_SOURCE = "welcome-bonus";

/** URL профиля с префиллом мин. депозита для welcome-бонуса */
export function buildWelcomeDepositPath(currencyCode: string): string {
  const limit = getWelcomeLimit(currencyCode);
  const params = new URLSearchParams({
    deposit: "welcome",
    amount: String(limit.minDeposit),
    currency: limit.currency,
  });
  return `/profile?${params.toString()}`;
}

export type WelcomeDepositParams = {
  amount: number;
  currency: string;
};

export function parseWelcomeDepositParams(
  searchParams: URLSearchParams | null | undefined,
): WelcomeDepositParams | null {
  if (!searchParams || searchParams.get("deposit") !== "welcome") return null;
  const amount = Number(searchParams.get("amount"));
  const currency = (searchParams.get("currency") ?? "").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;
  return { amount, currency };
}
