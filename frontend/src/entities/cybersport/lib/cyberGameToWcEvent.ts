import type { CyberGame } from "~/entities/cybersport/api/client";
import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";
import { extractCyberWinOdds } from "~/entities/wc-odds/ui/topEventsUtils";

export type CyberWcBettingMeta = {
  wcBetting?: boolean;
  wcEventRef?: string;
  wcOddsHome?: number | null;
  wcOddsAway?: number | null;
  wcOddsDraw?: number | null;
  wcCommenceTime?: string;
  wcCompleted?: boolean;
  wcHasBroadcast?: boolean;
  hasBroadcast?: boolean;
  commenceTime?: string;
  marketsCount?: number;
};

export function readCyberWcMeta(game: CyberGame): CyberWcBettingMeta {
  const meta = (game.meta ?? {}) as CyberWcBettingMeta;
  return meta;
}

export function cyberGameSupportsWcBetting(game: CyberGame): boolean {
  const meta = readCyberWcMeta(game);
  if (!meta.wcEventRef) return false;
  if (meta.wcBetting) return true;
  // Bridge may miss 1X2 on live map-scoped esports while WC feed still has markets.
  return (meta.marketsCount ?? 0) > 0;
}

function cyberGamePhase(game: CyberGame): "prematch" | "live" | "finished" {
  const meta = readCyberWcMeta(game);
  const completed = meta.wcCompleted ?? (game.status === "FINISHED" || game.status === "CANCELED");
  if (completed) return "finished";
  const isLive =
    game.status === "IN_PROGRESS"
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.status === "STARTING";
  return isLive ? "live" : "prematch";
}

export function cyberGameToWcEventDetail(game: CyberGame): WcEventDetail {
  const meta = readCyberWcMeta(game);
  const wcRef = meta.wcEventRef ?? game.eventId;
  const fallbackOdds = extractCyberWinOdds(game);
  const phase = cyberGamePhase(game);
  const completed = phase === "finished";
  const hasBroadcast = Boolean(
    meta.wcHasBroadcast
    || meta.hasBroadcast
    || (game.meta as { hasBroadcast?: boolean } | undefined)?.hasBroadcast,
  );

  return {
    id: wcRef,
    slug: wcRef,
    sport: game.sport,
    leagueName: game.leagueName ?? "",
    tournamentId: null,
    homeTeam: game.team1 ?? "",
    awayTeam: game.team2 ?? "",
    commenceTime: meta.wcCommenceTime ?? meta.commenceTime ?? new Date().toISOString(),
    oddsHome: meta.wcOddsHome ?? fallbackOdds.home,
    oddsDraw: meta.wcOddsDraw ?? fallbackOdds.draw,
    oddsAway: meta.wcOddsAway ?? fallbackOdds.away,
    totalLine: null,
    oddsOver: null,
    oddsUnder: null,
    bookmaker: "",
    completed,
    homeScore: game.parsedScore?.currentScore?.[0] != null
      ? Number(game.parsedScore.currentScore[0])
      : null,
    awayScore: game.parsedScore?.currentScore?.[1] != null
      ? Number(game.parsedScore.currentScore[1])
      : null,
    bettingOpen: !completed,
    phase,
    oddsUpdatedAt: null,
    marketsCount: meta.marketsCount ?? 1,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    parsedScore: game.parsedScore ?? null,
    homeTeamIcon: game.team1Icon ?? null,
    awayTeamIcon: game.team2Icon ?? null,
    hasBroadcast,
    hasHeadToHead: false,
    priorityLevel: game.priority ?? 0,
    isPriority: (game.priority ?? 0) > 0,
    feedStatus: null,
    groupedMarkets: {},
  };
}

export function cyberGameToWcEvent(game: CyberGame): WcEvent | null {
  const meta = readCyberWcMeta(game);
  if (!cyberGameSupportsWcBetting(game)) return null;

  const fallbackOdds = extractCyberWinOdds(game);
  const oddsHome = meta.wcOddsHome ?? fallbackOdds.home;
  const oddsAway = meta.wcOddsAway ?? fallbackOdds.away;
  const oddsDraw = meta.wcOddsDraw ?? fallbackOdds.draw;
  const commenceTime = meta.wcCommenceTime ?? meta.commenceTime ?? new Date().toISOString();
  const isLive =
    game.status === "IN_PROGRESS"
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.status === "STARTING";
  const completed = meta.wcCompleted ?? (game.status === "FINISHED" || game.status === "CANCELED");
  const hasBroadcast = Boolean(
    meta.wcHasBroadcast
    || meta.hasBroadcast
    || (game.meta as { hasBroadcast?: boolean } | undefined)?.hasBroadcast,
  );

  return {
    id: meta.wcEventRef,
    slug: meta.wcEventRef,
    sport: game.sport,
    leagueName: game.leagueName ?? "",
    tournamentId: null,
    homeTeam: game.team1 ?? "",
    awayTeam: game.team2 ?? "",
    commenceTime,
    oddsHome,
    oddsDraw,
    oddsAway,
    totalLine: null,
    oddsOver: null,
    oddsUnder: null,
    bookmaker: "",
    completed,
    homeScore: game.parsedScore?.currentScore?.[0] != null
      ? Number(game.parsedScore.currentScore[0])
      : null,
    awayScore: game.parsedScore?.currentScore?.[1] != null
      ? Number(game.parsedScore.currentScore[1])
      : null,
    bettingOpen: !completed,
    phase: completed ? "finished" : isLive ? "live" : "prematch",
    oddsUpdatedAt: null,
    marketsCount: meta.marketsCount ?? 1,
    odds1X: null,
    odds12: null,
    oddsX2: null,
    parsedScore: game.parsedScore ?? null,
    homeTeamIcon: game.team1Icon ?? null,
    awayTeamIcon: game.team2Icon ?? null,
    hasBroadcast,
    hasHeadToHead: false,
    priorityLevel: game.priority ?? 0,
    isPriority: (game.priority ?? 0) > 0,
    feedStatus: null,
  };
}
