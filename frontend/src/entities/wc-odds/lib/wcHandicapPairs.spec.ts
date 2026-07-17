import { describe, expect, it } from "vitest";

import type { WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { handicapRowSideLabel } from "~/entities/wc-odds/lib/wcHandicapPairs";

function outcome(partial: Partial<WcMarketOutcome> & Pick<WcMarketOutcome, "name" | "outcomeKey">): WcMarketOutcome {
  return {
    price: 1.9,
    point: null,
    ...partial,
  };
}

describe("handicapRowSideLabel", () => {
  it("uses short team labels in cyber kick layout", () => {
    const home = outcome({ name: "Ф1 (-1.5)", outcomeKey: "HOME_HCP_-1.5" });
    const away = outcome({ name: "Ф2 (1.5)", outcomeKey: "AWAY_HCP_1.5" });

    expect(
      handicapRowSideLabel(home, "Hastra Gaming", { kickChip: true, pivot: "-1.5", side: "home" }),
    ).toBe("Hastra Gaming");
    expect(
      handicapRowSideLabel(away, "Helix Gaming", { kickChip: true, pivot: "-1.5", side: "away" }),
    ).toBe("Helix Gaming");
  });

  it("shows complementary signed lines in classic layout", () => {
    const home = outcome({ name: "Ф1 (-1.5)", outcomeKey: "HOME_HCP_-1.5" });
    const away = outcome({ name: "Ф2 (-1.5)", outcomeKey: "AWAY_HCP_-1.5" });

    expect(
      handicapRowSideLabel(home, "Hastra Gaming", { pivot: "-1.5", side: "home" }),
    ).toBe("Hastra Gaming (−1.5)");
    expect(
      handicapRowSideLabel(away, "Helix Gaming", { pivot: "-1.5", side: "away" }),
    ).toBe("Helix Gaming (+1.5)");
  });
});
