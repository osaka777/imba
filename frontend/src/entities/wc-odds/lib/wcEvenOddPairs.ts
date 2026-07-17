import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

export type EvenOddPairRow = {
  even?: WcMarketOutcome;
  odd?: WcMarketOutcome;
};

function normalizeEvenOddText(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function isEvenOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey === "EVEN") return true;
  const name = normalizeEvenOddText(outcome.name);
  return /чет/.test(name) && !/нечет/.test(name);
}

function isOddOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey === "ODD") return true;
  return /нечет/.test(normalizeEvenOddText(outcome.name));
}

export function findEvenOddPair(group: WcMarketGroup): EvenOddPairRow {
  let even = group.outcomes.find((o) => o.outcomeKey === "EVEN") ?? group.outcomes.find(isEvenOutcome);
  let odd = group.outcomes.find((o) => o.outcomeKey === "ODD") ?? group.outcomes.find(isOddOutcome);

  if ((!even || !odd) && group.outcomes.length === 2) {
    const sorted = [...group.outcomes];
    if (!even && !odd) {
      even = sorted.find(isEvenOutcome) ?? sorted[0];
      odd = sorted.find(isOddOutcome) ?? sorted.find((o) => o !== even);
    }
  }

  return { even, odd };
}
