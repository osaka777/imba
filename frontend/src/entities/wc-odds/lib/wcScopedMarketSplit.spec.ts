import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { expandScopedMarketEntries } from "~/entities/wc-odds/lib/wcScopedMarketSplit";

function group(
  partial: Partial<WcMarketGroup> & Pick<WcMarketGroup, "label" | "marketKey">,
): WcMarketGroup {
  return {
    key: partial.key ?? `${partial.marketKey}-${partial.label}`,
    outcomes: [],
    ...partial,
  };
}

describe("expandScopedMarketEntries", () => {
  const options = {
    homeTeam: "Хитрые Лисы",
    awayTeam: "Меткие Стрелки",
    sport: "soccer",
  };

  it("splits individual totals into separate categories per team", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Индивидуальный тотал",
        [
          group({ key: "h1", marketKey: "totals_home", label: "1.5" }),
          group({ key: "a1", marketKey: "totals_away", label: "1.5" }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    expect(expanded).toHaveLength(2);
    expect(expanded[0][0]).toBe("Меткие Стрелки · инд. тотал");
    expect(expanded[1][0]).toBe("Хитрые Лисы · инд. тотал");
  });

  it("keeps single-scope main total as one category", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Тотал",
        [group({ key: "t1", marketKey: "totals", label: "2.5" })],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    expect(expanded).toHaveLength(1);
    expect(expanded[0][0]).toBe("Тотал");
  });
});
