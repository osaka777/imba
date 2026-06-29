import type {
  WcEventDetail,
  WcGroupedMarkets,
  WcMarketGroup,
} from "~/entities/wc-odds/api/client";
import { mergeWcParsedScore } from "~/entities/wc-odds/lib/wcLiveScore";
import { mergeStatListForEvent } from "~/entities/wc-odds/lib/wcStatsMerge";

function marketsEqual(a: WcGroupedMarkets, b: WcGroupedMarkets): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeMarketGroup(prev: WcMarketGroup, incoming: WcMarketGroup): WcMarketGroup {
  if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;

  const prevByKey = new Map(prev.outcomes.map((outcome) => [outcome.outcomeKey, outcome]));
  const outcomes = incoming.outcomes.map((incomingOutcome) => {
    const prevOutcome = prevByKey.get(incomingOutcome.outcomeKey);
    if (prevOutcome && JSON.stringify(prevOutcome) === JSON.stringify(incomingOutcome)) {
      return prevOutcome;
    }
    return incomingOutcome;
  });

  const merged: WcMarketGroup = { ...incoming, outcomes };
  if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
  return merged;
}

/** Incoming WS snapshot is authoritative — drop categories/groups absent from the feed. */
function isMatchMarketsClosed(
  event: Pick<WcEventDetail, "completed" | "phase" | "feedStatus">,
): boolean {
  if (event.completed || event.phase === "finished") return true;
  if (event.feedStatus === "EVENT_FINISHED") return true;
  return false;
}

function mergeGroupedMarkets(
  prev: WcGroupedMarkets,
  incoming: WcGroupedMarkets | undefined,
  event: Pick<WcEventDetail, "completed" | "phase" | "feedStatus">,
): WcGroupedMarkets {
  const safePrev = prev ?? {};
  if (incoming == null) return safePrev;
  if (marketsEqual(safePrev, incoming)) return safePrev;

  if (Object.keys(incoming).length === 0) {
    return isMatchMarketsClosed(event) ? {} : safePrev;
  }

  const merged: WcGroupedMarkets = {};

  for (const [name, incomingGroups] of Object.entries(incoming)) {
    const prevGroups = safePrev[name] ?? [];
    merged[name] = incomingGroups.map((incomingGroup) => {
      const prevGroup = prevGroups.find((group) => group.key === incomingGroup.key);
      if (!prevGroup) return incomingGroup;
      return mergeMarketGroup(prevGroup, incomingGroup);
    });
  }

  return merged;
}

function eventScalarsEqual(a: WcEventDetail, b: WcEventDetail): boolean {
  return (
    a.sport === b.sport &&
    a.leagueName === b.leagueName &&
    a.marketsCount === b.marketsCount &&
    a.odds1X === b.odds1X &&
    a.odds12 === b.odds12 &&
    a.oddsX2 === b.oddsX2 &&
    a.oddsHome === b.oddsHome &&
    a.oddsDraw === b.oddsDraw &&
    a.oddsAway === b.oddsAway &&
    a.oddsOver === b.oddsOver &&
    a.oddsUnder === b.oddsUnder &&
    a.totalLine === b.totalLine &&
    a.bettingOpen === b.bettingOpen &&
    a.phase === b.phase &&
    a.completed === b.completed &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    a.oddsUpdatedAt === b.oddsUpdatedAt &&
    a.homeTeamIcon === b.homeTeamIcon &&
    a.awayTeamIcon === b.awayTeamIcon &&
    a.hasBroadcast === b.hasBroadcast &&
    a.hasHeadToHead === b.hasHeadToHead &&
    JSON.stringify(a.parsedScore) === JSON.stringify(b.parsedScore) &&
    JSON.stringify(a.statList) === JSON.stringify(b.statList)
  );
}

/** Patch odds/score in place — keep stable refs for unchanged outcomes (BetAPI WS-style). */
export function mergeWcEventDetail(prev: WcEventDetail, incoming: WcEventDetail): WcEventDetail {
  const groupedMarkets = mergeGroupedMarkets(prev.groupedMarkets, incoming.groupedMarkets, incoming);
  const parsedScore = mergeWcParsedScore(prev.parsedScore, incoming.parsedScore);
  const statList = mergeStatListForEvent(incoming.id, prev.statList, incoming.statList);

  const merged: WcEventDetail = {
    ...incoming,
    groupedMarkets,
    parsedScore,
    statList,
    homeScore: incoming.homeScore ?? prev.homeScore,
    awayScore: incoming.awayScore ?? prev.awayScore,
    homeTeamIcon: incoming.homeTeamIcon ?? prev.homeTeamIcon,
    awayTeamIcon: incoming.awayTeamIcon ?? prev.awayTeamIcon,
    hasBroadcast: incoming.hasBroadcast ?? prev.hasBroadcast,
    hasHeadToHead: incoming.hasHeadToHead ?? prev.hasHeadToHead,
  };

  if (eventScalarsEqual(prev, merged) && groupedMarkets === prev.groupedMarkets) {
    return prev;
  }

  return merged;
}

export function wcMatchPollMs(phase: WcEventDetail["phase"]): number {
  if (phase === "live") return 15_000;
  if (phase === "prematch") return 60_000;
  return 120_000;
}
