import { describe, expect, it } from "vitest";

import {
  deriveNormalizedTabScope,
  normalizeScopedCategoryName,
} from "~/entities/wc-odds/lib/wcCategoryNormalize";
import {
  formatWcCategoryDisplayName,
  mergeEntriesByDisplayName,
} from "~/entities/wc-odds/lib/wcOddsCategories";
import type { WcMarketGroup } from "~/entities/wc-odds/api/client";

describe("normalizeScopedCategoryName", () => {
  it("normalizes tiebreak points category", () => {
    const result = normalizeScopedCategoryName("Очки в тай-брейке 2-й сет");
    expect(result.display).toBe("Тай-брейк");
    expect(result.tabScope).toBe("2-й сет");
    expect(result.scopedDisplay).toBe("2-й сет · Тай-брейк");
  });

  it("normalizes score in game with set scope", () => {
    const result = normalizeScopedCategoryName("Счет в гейме, 2-й сет");
    expect(result.display).toBe("Счёт в гейме");
    expect(result.tabScope).toBe("2-й сет");
  });

  it("normalizes next point markets", () => {
    const result = normalizeScopedCategoryName("Следующее очко в гейме, 2-й сет, 3-й гейм");
    expect(result.display).toBe("Следующее очко");
    expect(result.tabScope).toBe("2-й сет");
    expect(result.scopedDisplay).toContain("3-й гейм");
  });

  it("keeps main line categories intact", () => {
    expect(normalizeScopedCategoryName("1X2").scopedDisplay).toBe("1X2");
    expect(normalizeScopedCategoryName("Фора").scopedDisplay).toBe("Фора");
  });

  it("does not duplicate period scope in accordion title", () => {
    const result = normalizeScopedCategoryName("1-й тайм · Обе забьют");
    expect(result.scopedDisplay).toBe("1-й тайм · Обе забьют");
  });
});

describe("deriveNormalizedTabScope", () => {
  it("extracts set tab from awkward names", () => {
    expect(deriveNormalizedTabScope("Очки в тай-брейке 2-й сет")).toBe("2-й сет");
  });
});

describe("formatWcCategoryDisplayName", () => {
  it("renders scoped tennis labels clearly", () => {
    expect(formatWcCategoryDisplayName("Очки в тай-брейке 2-й сет", "tennis")).toBe(
      "2-й сет · Тай-брейк",
    );
  });

  it("humanizes ambiguous score category", () => {
    expect(formatWcCategoryDisplayName("Счет", "esports.dota2")).toBe("Точный счёт");
  });

  it("replaces home/away labels with team names", () => {
    const teams = { homeTeam: "Лос-Анджелес 2", awayTeam: "Хьюстон Динамо 2" };
    expect(formatWcCategoryDisplayName("Точное число голов (хозяева)", teams)).toBe(
      "Точное число голов (Лос-Анджелес 2)",
    );
    expect(formatWcCategoryDisplayName("Точное число голов (гости)", teams)).toBe(
      "Точное число голов (Хьюстон Динамо 2)",
    );
    expect(formatWcCategoryDisplayName("Диапазон голов (гости)", teams)).toBe(
      "Диапазон голов (Хьюстон Динамо 2)",
    );
  });

  it("does not duplicate half scope in goals-half accordion title", () => {
    expect(formatWcCategoryDisplayName("1-й тайм · Голы в 1-м тайме")).toBe(
      "1-й тайм · Голы в 1-м тайме",
    );
    expect(formatWcCategoryDisplayName("2-й тайм · Голы во 2-м тайме")).toBe(
      "2-й тайм · Голы во 2-м тайме",
    );
  });

  it("uses half labels for basketball instead of football-style тайм", () => {
    expect(formatWcCategoryDisplayName("1-й тайм · Тотал очков", "basketball")).toBe(
      "1-я половина · Тотал очков",
    );
    expect(formatWcCategoryDisplayName("2-й тайм · Тотал очков", "cyber-basketball")).toBe(
      "2-я половина · Тотал очков",
    );
  });
});

describe("mergeEntriesByDisplayName", () => {
  it("merges duplicate awkward categories", () => {
    const groupA = { key: "a", marketKey: "totals", label: "", outcomes: [] } as WcMarketGroup;
    const groupB = { key: "b", marketKey: "h2h", label: "", outcomes: [] } as WcMarketGroup;

    const merged = mergeEntriesByDisplayName([
      ["Очки в тай-брейке 2-й сет", [groupA]],
      ["2-й сет, Тай-брейк", [groupB]],
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]![0]).toBe("2-й сет · Тай-брейк");
    expect(merged[0]![1]).toHaveLength(2);
  });
});
