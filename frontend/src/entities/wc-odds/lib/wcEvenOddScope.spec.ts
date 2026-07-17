import { describe, expect, it } from "vitest";

import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  expandEvenOddScopeCategories,
  formatEvenOddScopeLabel,
  mergeEvenOddCategoryWithScope,
  shouldShowEvenOddGroupSubLabel,
} from "~/entities/wc-odds/lib/wcEvenOddScope";

function evenOddGroup(overrides: Partial<WcMarketGroup> = {}): WcMarketGroup {
  return {
    key: "g1",
    marketKey: "even_odd",
    label: "Тотал (Чет/Нечет)",
    outcomes: [
      { outcomeKey: "EVEN", name: "Чет", price: 1.88 },
      { outcomeKey: "ODD", name: "Нечет", price: 1.89 },
    ],
    ...overrides,
  };
}

describe("wcEvenOddScope", () => {
  it("extracts set scope from group label", () => {
    const group = evenOddGroup({ label: "Тотал (Чет/Нечет) 1-й сет" });
    expect(formatEvenOddScopeLabel(group, "Тотал (Чет/Нечет)")).toBe("1-й сет");
  });

  it("splits match and set even/odd into separate categories", () => {
    const match = evenOddGroup({ key: "match", label: "Тотал (Чет/Нечет)" });
    const set = evenOddGroup({ key: "set1", label: "Тотал (Чет/Нечет) 1-й сет" });

    const expanded = expandEvenOddScopeCategories([
      ["Тотал (Чет/Нечет)", [match, set]],
    ]);

    expect(expanded).toEqual([
      ["Матч · Тотал (Чет/Нечет)", [match]],
      ["1-й сет · Тотал (Чет/Нечет)", [set]],
    ]);
  });

  it("labels OT even/odd separately", () => {
    const regular = evenOddGroup({ key: "reg" });
    const withOt = evenOddGroup({ key: "ot", marketKey: "even_odd_ot" });

    expect(mergeEvenOddCategoryWithScope("Тотал (Чет/Нечет)", regular)).toBe(
      "Матч · Тотал (Чет/Нечет)",
    );
    expect(mergeEvenOddCategoryWithScope("Тотал (Чет/Нечет)", withOt)).toBe(
      "с ОТ · Тотал (Чет/Нечет)",
    );
  });

  it("splits even/odd bundled under set tab title", () => {
    const set1 = evenOddGroup({ key: "s1", label: "Тотал (Чет/Нечет) 1-й сет" });
    const set2 = evenOddGroup({ key: "s2", label: "Тотал (Чет/Нечет) 2-й сет" });

    const expanded = expandEvenOddScopeCategories([
      ["1-й сет", [set1, set2]],
    ]);

    expect(expanded).toEqual([
      ["1-й сет · Тотал (Чет/Нечет)", [set1]],
      ["2-й сет · Тотал (Чет/Нечет)", [set2]],
    ]);
  });

  it("does not treat outcome names as scope labels", () => {
    const group = evenOddGroup({ label: "Чет" });
    expect(formatEvenOddScopeLabel(group, "Основные")).toBeNull();
    expect(shouldShowEvenOddGroupSubLabel(group, "Основные")).toBe(false);
  });

  it("titles single half even/odd under period tab", () => {
    const half = evenOddGroup({ key: "h1", label: "Тотал (Чет/Нечет)" });

    expect(mergeEvenOddCategoryWithScope("1-й тайм", half)).toBe(
      "1-й тайм · Тотал (Чет/Нечет)",
    );

    const expanded = expandEvenOddScopeCategories([["1-й тайм", [half]]]);
    expect(expanded).toEqual([["1-й тайм · Тотал (Чет/Нечет)", [half]]]);
  });
});
