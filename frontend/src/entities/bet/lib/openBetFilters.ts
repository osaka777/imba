import type { WcBet, WcExpressBet } from "~/entities/wc-odds/api/client";

export type OpenBetFilter = "all" | "live" | "line" | "today";

export type OpenBetKind = "wc" | "wc-express" | "ordinar" | "express";

export type OpenBetEntry = {
  key: string;
  kind: OpenBetKind;
  createdAt: string;
  isLive: boolean;
  isLine: boolean;
  isToday: boolean;
  wcBet?: WcBet;
  wcExpressBet?: WcExpressBet;
  ordinarBet?: Record<string, unknown>;
  expressBet?: Record<string, unknown>;
};

function isSameLocalDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  );
}

export function isWcBetLive(bet: WcBet): boolean {
  const { event } = bet;
  if (event.completed) return false;
  if (event.phase === "live") return true;
  if (event.parsedScore?.liveScore?.active) return true;
  if (event.homeScore != null && Date.parse(event.commenceTime) <= Date.now()) return true;
  return false;
}

export function isWcBetLine(bet: WcBet): boolean {
  if (bet.event.completed) return false;
  return !isWcBetLive(bet);
}

function isLegacyGameLive(game: Record<string, unknown> | undefined): boolean {
  if (!game) return false;
  const ps = game.parsedScore as { liveScore?: { active?: number } } | undefined;
  return Boolean(
    ps?.liveScore?.active
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.live === true,
  );
}

export function buildOpenBetEntries(
  wcBets: WcBet[],
  wcExpressBets: WcExpressBet[],
  ordinars: Array<Record<string, unknown>>,
  expresses: Array<Record<string, unknown>>,
): OpenBetEntry[] {
  const entries: OpenBetEntry[] = [];

  for (const bet of wcBets) {
    const isLive = isWcBetLive(bet);
    entries.push({
      key: `wc-${bet.id}`,
      kind: "wc",
      createdAt: bet.createdAt,
      isLive,
      isLine: !isLive && !bet.event.completed,
      isToday: isSameLocalDay(bet.createdAt),
      wcBet: bet,
    });
  }

  for (const bet of wcExpressBets) {
    const isLive = bet.legs.some((leg) => isWcBetLive(leg));
    const allCompleted = bet.legs.every((leg) => leg.event.completed);
    entries.push({
      key: `wc-e-${bet.id}`,
      kind: "wc-express",
      createdAt: bet.createdAt,
      isLive,
      isLine: !isLive && !allCompleted,
      isToday: isSameLocalDay(bet.createdAt),
      wcExpressBet: bet,
    });
  }

  for (const bet of ordinars) {
    const game = bet.game as Record<string, unknown> | undefined;
    const isLive = isLegacyGameLive(game);
    entries.push({
      key: `r-${bet.id}`,
      kind: "ordinar",
      createdAt: String(bet.createdAt ?? ""),
      isLive,
      isLine: !isLive,
      isToday: isSameLocalDay(String(bet.createdAt ?? "")),
      ordinarBet: bet,
    });
  }

  for (const bet of expresses) {
    const legs = (bet.bets as Array<Record<string, unknown>> | undefined) ?? [];
    const isLive = legs.some((leg) => isLegacyGameLive(leg.game as Record<string, unknown> | undefined));
    entries.push({
      key: `e-${bet.id}`,
      kind: "express",
      createdAt: String(bet.createdAt ?? ""),
      isLive,
      isLine: !isLive,
      isToday: isSameLocalDay(String(bet.createdAt ?? "")),
      expressBet: bet,
    });
  }

  return entries.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function filterOpenBetEntries(
  entries: OpenBetEntry[],
  filter: OpenBetFilter,
): OpenBetEntry[] {
  switch (filter) {
    case "live":
      return entries.filter((e) => e.isLive);
    case "line":
      return entries.filter((e) => e.isLine);
    case "today":
      return entries.filter((e) => e.isToday);
    default:
      return entries;
  }
}

export function isFreshOpenBet(createdAt: string, windowMs = 20_000): boolean {
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= windowMs;
}
