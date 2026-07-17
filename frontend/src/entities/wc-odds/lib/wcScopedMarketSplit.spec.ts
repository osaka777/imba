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

  it("splits HALF_MATCH + total into HT/FT sections", () => {
    const mk = (code: string, line: string) =>
      group({
        key: `${code}-${line}`,
        marketKey: `display_HALF_MATCH_${code}_AND_TOTAL`,
        label: line,
        outcomes: [
          { outcomeKey: `UNDER_${line}`, name: "ТМ", price: 2, point: Number(line) },
          { outcomeKey: `OVER_${line}`, name: "ТБ", price: 1.8, point: Number(line) },
        ],
      });

    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Тайм - Матч и Тотал матча",
        [mk("W1W1", "1.5"), mk("W1W1", "2.5"), mk("W2X", "1.5"), mk("XX", "2.5")],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, {
      ...options,
      homeTeam: "Аргентина",
      awayTeam: "Испания",
    });
    const titles = expanded.map(([name]) => name);
    expect(titles).toEqual(["Арг/Арг · тотал", "X/X · тотал", "Исп/X · тотал"]);
    expect(expanded[0][1]).toHaveLength(2);
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

  it("expands short combo scope titles for result + total markets", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Результат + тотал",
        [
          group({
            key: "c12",
            marketKey: "display_12_AND_TOTAL_OVER_YES_NO",
            label: "12",
            outcomes: [
              { outcomeKey: "YES", name: "Да", price: 2.1 },
              { outcomeKey: "NO", name: "Нет", price: 1.7 },
            ],
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    expect(expanded[0][0]).toBe("12 · тотал больше");
  });

  it("expands double-chance combo totals split by variant label", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Двойной шанс и Тотал",
        [
          group({
            key: "c12a",
            marketKey: "display_12_AND_TOTAL",
            label: "12",
            outcomes: [
              { outcomeKey: "UNDER_1.5", name: "ТМ", price: 4.67, point: 1.5 },
              { outcomeKey: "OVER_1.5", name: "ТБ", price: 1.69, point: 1.5 },
            ],
          }),
          group({
            key: "c12b",
            marketKey: "display_12_AND_TOTAL",
            label: "12",
            outcomes: [
              { outcomeKey: "OVER_2.5", name: "ТБ", price: 2.2, point: 2.5 },
              { outcomeKey: "UNDER_2.5", name: "ТМ", price: 2.93, point: 2.5 },
            ],
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    expect(expanded).toHaveLength(1);
    expect(expanded[0][0]).toBe("12 · тотал");
    expect(expanded[0][1]).toHaveLength(2);
  });

  it("splits even/odd out of corners half stat block", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Угловые 1-й тайм",
        [
          group({
            key: "eo1",
            marketKey: "even_odd",
            label: "",
            outcomes: [
              { outcomeKey: "EVEN", name: "Чет", price: 1.71 },
              { outcomeKey: "ODD", name: "Неч", price: 2.1 },
            ],
          }),
          group({
            key: "t1",
            marketKey: "totals",
            label: "Угловые 1-й тайм · 4.5",
            outcomes: [
              { outcomeKey: "UNDER_4.5", name: "ТМ", price: 1.5 },
              { outcomeKey: "OVER_4.5", name: "ТБ", price: 2.4 },
            ],
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    const titles = expanded.map(([title]) => title);
    expect(titles).toContain("Угловые 1-й тайм · Тотал (Чет/Нечет)");
    expect(titles.some((title) => /тотал|4\.5/i.test(title))).toBe(true);
  });

  it("peels asian quarter-lines out of plain Тотал", () => {
    const entries: Array<[string, WcMarketGroup[]]> = [
      [
        "Тотал",
        [
          group({
            key: "reg",
            marketKey: "totals",
            label: "Тотал · 2.5",
            outcomes: [
              { outcomeKey: "UNDER_2.5", name: "ТМ", price: 1.6, point: 2.5 },
              { outcomeKey: "OVER_2.5", name: "ТБ", price: 2.35, point: 2.5 },
            ],
          }),
          group({
            key: "asian",
            marketKey: "totals",
            label: "Тотал · 2.25",
            outcomes: [
              { outcomeKey: "UNDER_2.25", name: "ТМ", price: 1.9, point: 2.25 },
              { outcomeKey: "OVER_2.25", name: "ТБ", price: 1.9, point: 2.25 },
            ],
          }),
        ],
      ],
    ];

    const expanded = expandScopedMarketEntries(entries, options);
    const byTitle = Object.fromEntries(expanded);
    expect(byTitle["Тотал"]).toHaveLength(1);
    expect(byTitle["Тотал"][0].key).toBe("reg");
    expect(byTitle["Азиатский тотал"]).toHaveLength(1);
    expect(byTitle["Азиатский тотал"][0].key).toBe("asian");
  });
});
