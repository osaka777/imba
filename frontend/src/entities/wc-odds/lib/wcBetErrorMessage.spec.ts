import { describe, expect, it } from "vitest";

import { formatWcBetErrorMessage, isWcBetOutcomeClosedError } from "./wcBetErrorMessage";

describe("wcBetErrorMessage", () => {
  it("translates known backend errors to Russian", () => {
    expect(formatWcBetErrorMessage("Odds unavailable for this outcome")).toBe(
      "Приём ставок на этот исход закрыт",
    );
    expect(formatWcBetErrorMessage("Betting closed for this match")).toBe(
      "Приём ставок на этот матч закрыт",
    );
  });

  it("formats stake range errors", () => {
    expect(formatWcBetErrorMessage("Stake must be between 100 and 1000000")).toBe(
      "Сумма ставки — от 100 до 1 000 000",
    );
    expect(formatWcBetErrorMessage("Stake must be between 100 and 1000000", "en")).toBe(
      "Stake must be between 100 and 1,000,000",
    );
  });

  it("keeps English output for en locale", () => {
    expect(formatWcBetErrorMessage("Odds unavailable for this outcome", "en")).toBe(
      "Betting closed for this outcome",
    );
  });

  it("detects closed outcome errors", () => {
    expect(isWcBetOutcomeClosedError("Odds unavailable for this outcome")).toBe(true);
    expect(isWcBetOutcomeClosedError("Insufficient funds")).toBe(false);
  });
});
