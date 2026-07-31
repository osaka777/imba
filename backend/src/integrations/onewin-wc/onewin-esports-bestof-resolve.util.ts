import type { OneWinOddsGroup } from './onewin-esports-markets.util';
import {
  coalesceBestOf,
  collectBestOfSignalsFromOddsGroups,
  inferOneWinBestOf,
} from './onewin-esports-bestof.util';
import type { WcMatchState } from '../wc-odds/wc-match-state.types';

/** Resolve bestOf from persisted state + fresh 1win odds/league signals. */
export function resolveOneWinBestOf(input: {
  leagueName?: null | string;
  oddsGroups?: OneWinOddsGroup[];
  prevState?: null | WcMatchState;
}): number | null {
  const signals = collectBestOfSignalsFromOddsGroups(input.oddsGroups ?? []);
  const inferred = inferOneWinBestOf({
    groupNames: signals.groupNames,
    leagueName: input.leagueName,
    seriesScoreLabels: signals.seriesScoreLabels,
  });
  return coalesceBestOf(input.prevState?.esports?.bestOf, inferred);
}
