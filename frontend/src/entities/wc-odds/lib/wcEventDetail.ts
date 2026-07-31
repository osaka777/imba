import type {
  WcEventDetail,
  WcGroupedMarkets,
  WcMarketGroup,
} from "~/entities/wc-odds/api/client";
import { mergeWcParsedScore } from "~/entities/wc-odds/lib/wcLiveScore";
import { mergeStatListForEvent } from "~/entities/wc-odds/lib/wcStatsMerge";
import { isWcOddsFresher } from "~/entities/wc-odds/lib/wcEventDetailOverlay";

function marketsEqual(a: WcGroupedMarkets, b: WcGroupedMarkets): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeMarketGroup(prev: WcMarketGroup, incoming: WcMarketGroup): WcMarketGroup {
  if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;

  const prevByKey = new Map(prev.outcomes.map((outcome) => [outcome.outcomeKey, outcome]));
  const outcomes = incoming.outcomes.map((incomingOutcome) => {
    const prevOutcome = prevByKey.get(incomingOutcome.outcomeKey);
    if (!prevOutcome) return incomingOutcome;
    if (prevOutcome.price === incomingOutcome.price
      && prevOutcome.name === incomingOutcome.name
      && prevOutcome.suspended === incomingOutcome.suspended) {
      return prevOutcome;
    }
    // Keep HTTP-localized names; WS carries RU labels + fresh prices.
    return {
      ...incomingOutcome,
      name: prevOutcome.name || incomingOutcome.name,
    };
  });

  const merged: WcMarketGroup = {
    ...incoming,
    label: prev.label || incoming.label,
    outcomes,
  };
  if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
  return merged;
}

function isMatchMarketsClosed(
  event: Pick<WcEventDetail, "completed" | "phase" | "feedStatus">,
): boolean {
  if (event.completed || event.phase === "finished") return true;
  if (event.feedStatus === "EVENT_FINISHED") return true;
  return false;
}

/** Incoming WS snapshot updates prices; keep previous category/label structure (locale-aware). */
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

  // Prefer existing (HTTP/locale) structure — only patch odds from WS.
  if (Object.keys(safePrev).length > 0) {
    const incomingByKey = new Map<string, WcMarketGroup>();
    for (const groups of Object.values(incoming)) {
      for (const group of groups) incomingByKey.set(group.key, group);
    }

    const merged: WcGroupedMarkets = {};
    for (const [category, prevGroups] of Object.entries(safePrev)) {
      merged[category] = prevGroups.map((prevGroup) => {
        const inc = incomingByKey.get(prevGroup.key);
        if (!inc) return prevGroup;
        return mergeMarketGroup(prevGroup, inc);
      });
    }
    return merged;
  }

  // Cold start: accept WS structure as-is.
  const merged: WcGroupedMarkets = {};
  for (const [name, incomingGroups] of Object.entries(incoming)) {
    merged[name] = incomingGroups;
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
    a.hasLiveTracker === b.hasLiveTracker &&
    a.hasHeadToHead === b.hasHeadToHead &&
    JSON.stringify(a.parsedScore) === JSON.stringify(b.parsedScore) &&
    JSON.stringify(a.statList) === JSON.stringify(b.statList)
  );
}

/** Patch odds/score — WS frames omit names (stripped in feed store); HTTP may refresh labels. */
export function mergeWcEventDetail(prev: WcEventDetail, incoming: WcEventDetail): WcEventDetail {
  // Stale SNAP_EVENT from cold eventCache must not overwrite a fresher list overlay.
  if (isWcOddsFresher(prev.oddsUpdatedAt, incoming.oddsUpdatedAt)) {
    const parsedScore = mergeWcParsedScore(prev.parsedScore, incoming.parsedScore);
    const statList = mergeStatListForEvent(incoming.id, prev.statList, incoming.statList);
    const merged: WcEventDetail = {
      ...prev,
      homeTeam: incoming.homeTeam || prev.homeTeam,
      awayTeam: incoming.awayTeam || prev.awayTeam,
      leagueName: incoming.leagueName || prev.leagueName,
      parsedScore,
      statList,
      homeScore: incoming.homeScore ?? prev.homeScore,
      awayScore: incoming.awayScore ?? prev.awayScore,
      homeTeamIcon: incoming.homeTeamIcon ?? prev.homeTeamIcon,
      awayTeamIcon: incoming.awayTeamIcon ?? prev.awayTeamIcon,
      hasBroadcast: incoming.hasBroadcast ?? prev.hasBroadcast,
      hasLiveTracker: incoming.hasLiveTracker ?? prev.hasLiveTracker,
      hasHeadToHead: incoming.hasHeadToHead ?? prev.hasHeadToHead,
    };
    if (eventScalarsEqual(prev, merged)) return prev;
    return merged;
  }

  const groupedMarkets = mergeGroupedMarkets(prev.groupedMarkets, incoming.groupedMarkets, incoming);
  const parsedScore = mergeWcParsedScore(prev.parsedScore, incoming.parsedScore);
  const statList = mergeStatListForEvent(incoming.id, prev.statList, incoming.statList);

  const merged: WcEventDetail = {
    ...incoming,
    homeTeam: incoming.homeTeam || prev.homeTeam,
    awayTeam: incoming.awayTeam || prev.awayTeam,
    leagueName: incoming.leagueName || prev.leagueName,
    groupedMarkets,
    parsedScore,
    statList,
    homeScore: incoming.homeScore ?? prev.homeScore,
    awayScore: incoming.awayScore ?? prev.awayScore,
    homeTeamIcon: incoming.homeTeamIcon ?? prev.homeTeamIcon,
    awayTeamIcon: incoming.awayTeamIcon ?? prev.awayTeamIcon,
    hasBroadcast: incoming.hasBroadcast ?? prev.hasBroadcast,
    hasLiveTracker: incoming.hasLiveTracker ?? prev.hasLiveTracker,
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
