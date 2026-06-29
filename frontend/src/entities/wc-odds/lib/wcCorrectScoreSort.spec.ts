import { describe, expect, it } from "vitest";

import { compareCorrectScoreOutcomes, sortCorrectScoreOutcomes } from "./wcCorrectScoreSort";

describe("wcCorrectScoreSort", () => {
  it("orders home wins, draws, then away wins", () => {
    const outcomes = [
      { name: "2:3", price: 18, outcomeKey: "a" },
      { name: "1:0", price: 5, outcomeKey: "b" },
      { name: "2:2", price: 6, outcomeKey: "c" },
      { name: "2:1", price: 4, outcomeKey: "d" },
      { name: "0:1", price: 7, outcomeKey: "e" },
    ];

    expect(sortCorrectScoreOutcomes(outcomes).map((o) => o.name)).toEqual([
      "1:0",
      "2:1",
      "2:2",
      "0:1",
      "2:3",
    ]);
  });

  it("sorts within home-win bucket by away goals then home goals", () => {
    expect(
      compareCorrectScoreOutcomes(
        { name: "2:1", price: 1, outcomeKey: "a" },
        { name: "1:0", price: 1, outcomeKey: "b" },
      ),
    ).toBeGreaterThan(0);
  });
});
