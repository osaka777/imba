import type { OneWinOddItem, OneWinOddsGroup } from './onewin-esports-markets.util';

function mergeOddItem(
  previous: OneWinOddItem | undefined,
  incoming: OneWinOddItem,
): OneWinOddItem {
  if (!previous) return incoming;
  return {
    ...previous,
    ...incoming,
    // Live deltas often omit labels — never wipe a known name/outcome.
    name: incoming.name?.trim() || previous.name,
    outcome: incoming.outcome?.trim() || previous.outcome,
    vars: incoming.vars ?? previous.vars,
  };
}

function mergeOddsList(
  previous: OneWinOddItem[] | undefined,
  incoming: OneWinOddItem[] | undefined,
): OneWinOddItem[] {
  if (!incoming?.length) return previous ?? [];
  if (!previous?.length) return incoming;

  const byId = new Map(previous.map((odd) => [odd.id, odd]));
  for (const odd of incoming) {
    if (!odd?.id) continue;
    byId.set(odd.id, mergeOddItem(byId.get(odd.id), odd));
  }
  return [...byId.values()];
}

function mergeGroup(
  existing: OneWinOddsGroup | undefined,
  incoming: OneWinOddsGroup,
): OneWinOddsGroup {
  return {
    ...existing,
    ...incoming,
    name: incoming.name?.trim() || existing?.name || incoming.name,
    oddsList: mergeOddsList(existing?.oddsList, incoming.oddsList),
  };
}

/**
 * Pure merge helper used by OneWinPushFeedService.applyOddsSnapshot —
 * extracted here for unit tests (partial WS deltas must not wipe the book).
 */
export function mergeOneWinOddsGroups(opts: {
  incoming: OneWinOddsGroup[];
  messageType?: string;
  previous: OneWinOddsGroup[] | null;
}): OneWinOddsGroup[] {
  const { incoming, messageType, previous } = opts;
  const prevGroups = previous ?? [];
  if (incoming.length === 0) return prevGroups;

  const namedIncoming = incoming.filter((g) => Boolean(g?.name?.trim()));
  const isFullSnapshot = messageType === 'match-odds-snapshot';

  if (!isFullSnapshot && namedIncoming.length === 0 && prevGroups.length > 0) {
    return prevGroups;
  }

  const byId = new Map(prevGroups.map((g) => [g.id, g]));
  for (const g of incoming) {
    if (!g?.id) continue;
    byId.set(g.id, mergeGroup(byId.get(g.id), g));
  }

  // Full / dense payloads define membership; sparse deltas only patch.
  if (
    isFullSnapshot
    || namedIncoming.length === 0
    || namedIncoming.length >= 10
    || prevGroups.length === 0
  ) {
    const incomingIds = new Set(incoming.map((g) => g.id).filter(Boolean));
    if (prevGroups.length === 0) return incoming;
    return [...byId.values()].filter((g) => incomingIds.has(g.id));
  }

  return [...byId.values()];
}
