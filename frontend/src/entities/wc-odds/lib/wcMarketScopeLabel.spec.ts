import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  formatHandicapScopeLabel,
  formatTotalsScopeLabel,
  totalsScopeBucketKey,
} from "~/entities/wc-odds/lib/wcMarketScopeLabel";

function group(partial: Partial<WcMarketGroup> & Pick<WcMarketGroup, "label">): WcMarketGroup {
  return {
    key: "g1",
    marketKey: "totals",
    outcomes: [],
    ...partial,
  };
}

describe("formatTotalsScopeLabel", () => {
  it("extracts set games total scope from dotted parser label", () => {
    expect(
      formatTotalsScopeLabel(group({ label: "2-й сет · Тотал геймов · 8.5" })),
    ).toBe("2-й сет · Тотал геймов");
  });

  it("infers match goals total from generic category", () => {
    expect(formatTotalsScopeLabel(group({ label: "12.5" }), "Тотал")).toBeNull();
  });

  it("hides match total scope caption for MMA", () => {
    expect(
      formatTotalsScopeLabel(group({ label: "12.5" }), "Тотал", { sport: "mma" }),
    ).toBeNull();
    expect(
      totalsScopeBucketKey(group({ label: "12.5" }), "Тотал", { sport: "mma" }),
    ).toBe("__match_total__mma");
  });

  it("hides match total scope caption for soccer-like main total", () => {
    expect(
      formatTotalsScopeLabel(
        group({ label: "Тотал голов · 1.5" }),
        "Тотал",
        { sport: "soccer" },
      ),
    ).toBeNull();
    expect(
      totalsScopeBucketKey(group({ label: "1.5" }), "Тотал голов", { sport: "soccer" }),
    ).toBe("__match_total__soccer");
  });

  it("labels individual totals by team side", () => {
    expect(
      formatTotalsScopeLabel(
        group({ label: "Тотал голов · 1.5", marketKey: "totals_home" }),
        "Индивидуальный тотал",
        { homeTeam: "Лос-Анджелес 2", awayTeam: "Хьюстон Динамо 2" },
      ),
    ).toBe("Лос-Анджелес 2 · инд. тотал");

    expect(
      formatTotalsScopeLabel(
        group({ label: "Тотал голов · 2.5", marketKey: "totals_away" }),
        "Индивидуальный тотал",
        { homeTeam: "Лос-Анджелес 2", awayTeam: "Хьюстон Динамо 2" },
      ),
    ).toBe("Хьюстон Динамо 2 · инд. тотал");
  });

  it("builds stable bucket keys for grouping rows", () => {
    const first = group({ label: "2-й сет · Тотал геймов · 4.5" });
    const second = group({ label: "2-й сет · Тотал геймов · 8.5", key: "g2" });
    expect(totalsScopeBucketKey(first, "Тотал")).toBe(totalsScopeBucketKey(second, "Тотал"));
  });
});

describe("formatHandicapScopeLabel", () => {
  it("maps totals scope to handicap wording", () => {
    expect(
      formatHandicapScopeLabel(group({ label: "2-й сет · Фора · -1.5", marketKey: "handicap" })),
    ).toBe("2-й сет · фора по геймам");
  });
});
