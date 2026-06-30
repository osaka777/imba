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

  it("splits set-tab race markets into separate categories", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "4-й сет",
        [
          group({
            key: "r2",
            marketKey: "display_RACE_TO_GAME",
            label: "Гонка до 2 геймов",
            outcomes: [{ name: "П1", price: 2.05, outcomeKey: "h" }],
          }),
          group({
            key: "r3",
            marketKey: "display_RACE_TO_GAME",
            label: "Гонка до 3 геймов",
            outcomes: [{ name: "П1", price: 2.05, outcomeKey: "h2" }],
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, { sport: "tennis" });
    expect(expanded.map(([name]) => name)).toEqual([
      "Гонка до 2 геймов",
      "Гонка до 3 геймов",
    ]);
  });

  it("splits next-point markets into separate categories", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Следующее очко в гейме",
        [
          group({
            key: "p1",
            marketKey: "display_NEXT_POINTS_GAME",
            label: "4-й сет, 7-й гейм, 3-е очко",
          }),
          group({
            key: "p2",
            marketKey: "display_NEXT_POINTS_GAME",
            label: "4-й сет, 7-й гейм, 4-е очко",
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, { sport: "tennis" });
    expect(expanded).toHaveLength(2);
    expect(expanded[0][0]).toBe("4-й сет, 7-й гейм, 3-е очко");
    expect(expanded[1][0]).toBe("4-й сет, 7-й гейм, 4-е очко");
  });

  it("pulls set totals out of stat categories into their own blocks", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Эйсы",
        [
          group({
            key: "t1",
            marketKey: "totals",
            label: "4-й сет · Тотал геймов · 9.5",
          }),
          group({
            key: "t2",
            marketKey: "totals",
            label: "4-й сет · Тотал геймов · 10.5",
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, { sport: "tennis" });
    expect(expanded).toHaveLength(1);
    expect(expanded[0][0]).toBe("4-й сет · Тотал геймов");
    expect(expanded[0][1]).toHaveLength(2);
  });
});
