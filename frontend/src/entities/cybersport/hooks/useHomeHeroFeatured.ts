"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCybersportLive, type CyberGame } from "~/entities/cybersport/api/client";
import { cyberGameHasVideo } from "~/entities/cybersport/lib/cyberGameHasVideo";
import {
  fetchWcLiveEvents,
  type WcEvent,
} from "~/entities/wc-odds/api/client";
import {
  compareWcEventPriority,
  isWcPriorityEvent,
} from "~/entities/wc-odds/lib/wcPriority";

export type HomeHeroCyberSlide = {
  kind: "cyber";
  key: string;
  game: CyberGame;
};

export type HomeHeroWcSlide = {
  kind: "wc";
  key: string;
  event: WcEvent;
};

export type HomeHeroSlide = HomeHeroCyberSlide | HomeHeroWcSlide;

const HERO_LIMIT = 6;
const FETCH_LIMIT = 48;

function isWorldCupLeague(leagueName: string): boolean {
  return /чемпионат мира|world cup/i.test(leagueName);
}

function isBigTennisTournament(leagueName: string): boolean {
  return /wimbledon|roland\s*garros|french\s*open|us\s*open|australian\s*open|atp\s*finals|wta\s*finals|masters|miami\s*open|indian\s*wells|madrid\s*open|rome|monte[\s-]?carlo|shanghai|paris\s*masters|grand\s*slam|опен|уимблдон|ролан\s*гаррос|australian|майами|мадрид|рим|шанхай|индиан[\s-]?уэллс/i.test(
    leagueName,
  );
}

function hasBettableOdds(event: WcEvent): boolean {
  return (
    (event.oddsHome != null && event.oddsHome > 1) ||
    (event.oddsAway != null && event.oddsAway > 1)
  );
}

function isHeroWcCandidate(event: WcEvent, sport: "soccer" | "tennis" | "basketball"): boolean {
  if (event.sport !== sport || event.completed || !event.hasBroadcast || !hasBettableOdds(event)) {
    return false;
  }
  if (sport === "basketball") return isWcPriorityEvent(event);
  if (sport === "soccer") {
    return isWcPriorityEvent(event) || isWorldCupLeague(event.leagueName);
  }
  return isWcPriorityEvent(event) || isBigTennisTournament(event.leagueName);
}

function compareHeroWc(a: WcEvent, b: WcEvent): number {
  const aLive = a.phase === "live" ? 1 : 0;
  const bLive = b.phase === "live" ? 1 : 0;
  if (aLive !== bLive) return bLive - aLive;
  const priorityDelta = compareWcEventPriority(a, b);
  if (priorityDelta !== 0) return priorityDelta;
  return Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
}

function pickHeroWc(
  live: WcEvent[],
  line: WcEvent[],
  sport: "soccer" | "tennis" | "basketball",
  limit: number,
): WcEvent[] {
  const pool = [...live, ...line]
    .filter((event) => isHeroWcCandidate(event, sport))
    .sort(compareHeroWc);

  const seen = new Set<string>();
  const out: WcEvent[] = [];
  for (const event of pool) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
    if (out.length >= limit) break;
  }
  return out;
}

/** Hero only shows matches with a real stream. */
function pickHeroCyber(games: CyberGame[], limit: number): CyberGame[] {
  const seen = new Set<string>();
  const out: CyberGame[] = [];
  for (const game of games) {
    if (!cyberGameHasVideo(game)) continue;
    if (seen.has(game.eventId)) continue;
    seen.add(game.eventId);
    out.push(game);
    if (out.length >= limit) break;
  }
  return out;
}

/** Interleave sports so the carousel is not cyber-only. */
export function buildHomeHeroSlides(
  cyberGames: CyberGame[],
  soccerLive: WcEvent[],
  soccerLine: WcEvent[],
  tennisLive: WcEvent[],
  tennisLine: WcEvent[],
  basketballLive: WcEvent[],
  basketballLine: WcEvent[],
): HomeHeroSlide[] {
  const soccer = pickHeroWc(soccerLive, soccerLine, "soccer", 2);
  const tennis = pickHeroWc(tennisLive, tennisLine, "tennis", 1);
  const basketball = pickHeroWc(basketballLive, basketballLine, "basketball", 1);
  const cyber = pickHeroCyber(cyberGames, 3);

  const queues: HomeHeroSlide[][] = [
    soccer.map((event) => ({ kind: "wc" as const, key: event.id, event })),
    cyber.map((game) => ({ kind: "cyber" as const, key: game.eventId, game })),
    tennis.map((event) => ({ kind: "wc" as const, key: event.id, event })),
    basketball.map((event) => ({ kind: "wc" as const, key: event.id, event })),
  ];

  const out: HomeHeroSlide[] = [];
  const seen = new Set<string>();
  let progress = true;
  while (out.length < HERO_LIMIT && progress) {
    progress = false;
    for (const queue of queues) {
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (seen.has(next.key)) continue;
        seen.add(next.key);
        out.push(next);
        progress = true;
        break;
      }
      if (out.length >= HERO_LIMIT) break;
    }
  }

  return out;
}

async function fetchHomeHeroSlides(): Promise<HomeHeroSlide[]> {
  // Video-only: prefer broadcast live feed; line rarely has streams.
  const [cyberRaw, soccerLive, tennisLive, basketballLive] = await Promise.all([
    fetchCybersportLive(undefined, Math.max(HERO_LIMIT * 4, 24)).catch(() => [] as CyberGame[]),
    fetchWcLiveEvents("soccer", FETCH_LIMIT, 0, null, null, true).catch(() => [] as WcEvent[]),
    fetchWcLiveEvents("tennis", FETCH_LIMIT, 0, null, null, true).catch(() => [] as WcEvent[]),
    fetchWcLiveEvents("basketball", FETCH_LIMIT, 0, null, null, true).catch(() => [] as WcEvent[]),
  ]);

  cyberRaw.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return buildHomeHeroSlides(
    cyberRaw,
    soccerLive,
    [],
    tennisLive,
    [],
    basketballLive,
    [],
  );
}

export function useHomeHeroFeatured() {
  return useQuery({
    queryKey: ["home-hero-featured", "video-only"],
    queryFn: fetchHomeHeroSlides,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
