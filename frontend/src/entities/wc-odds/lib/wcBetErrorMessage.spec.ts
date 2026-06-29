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
    expect(formatWcBetErrorMessage("Stake must be between 100 and 500000")).toBe(
      "Сумма ставки — от 100 до 500 000",
    );
  });

  it("detects closed outcome errors", () => {
    expect(isWcBetOutcomeClosedError("Odds unavailable for this outcome")).toBe(true);
    expect(isWcBetOutcomeClosedError("Insufficient funds")).toBe(false);
  });
});
