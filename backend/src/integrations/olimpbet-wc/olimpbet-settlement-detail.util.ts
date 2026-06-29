import { pickLinkedEventIds } from './olimpbet-wc-markets.parser';
import type { OlimpbetEventDetail } from './olimpbet-wc.types';

type OlimpbetMarketBlock = NonNullable<OlimpbetEventDetail['probabilities']>['markets'][number];

function mergeProbabilityMarkets(
  sources: OlimpbetEventDetail[],
): OlimpbetMarketBlock[] {
  const merged = new Map<number, OlimpbetMarketBlock>();

  for (const detail of sources) {
    for (const market of detail.probabilities?.markets ?? []) {
      const existing = merged.get(market.marketId);
      if (!existing) {
        merged.set(market.marketId, {
          ...market,
          probabilities: [...(market.probabilities ?? [])],
        });
        continue;
      }
      existing.probabilities.push(...(market.probabilities ?? []));
    }
  }

  return [...merged.values()];
}

/** Merge main + linked event probabilities (Spesial_bets, Offsides, …) for settlement snapshots. */
export function mergeOlimpbetProbabilityDetails(
  main: OlimpbetEventDetail,
  linked: OlimpbetEventDetail[],
): OlimpbetEventDetail {
  const markets = mergeProbabilityMarkets([main, ...linked]);
  if (markets.length === 0) return main;

  return {
    ...main,
    probabilities: {
      eventId: main.id,
      markets,
    },
  };
}

export function linkedEventIdsForSettlement(main: OlimpbetEventDetail): number[] {
  return pickLinkedEventIds(main);
}
