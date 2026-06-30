import type { Rate } from "~/entities/bet/types";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";

export function formatCouponPlacedAt(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).replace(",", " ·");
}

export function formatCouponKickoff(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

export function getCouponPhaseBadge(rate: Rate): { label: string; tone: "live" | "line" } {
  if (rate.wcPhase === "live" || rate.isLive) {
    return { label: "Live", tone: "live" };
  }
  return { label: "Линия", tone: "line" };
}

export function getCouponMatchTimeLine(
  rate: Rate,
  options?: { includePhase?: boolean },
): string | null {
  const includePhase = options?.includePhase ?? false;

  if (rate.wcPhase === "live" || rate.isLive) {
    const parts: string[] = [];
    if (includePhase) parts.push("Live");
    if (rate.wcLiveTimeLabel) parts.push(rate.wcLiveTimeLabel);
    if (rate.homeScore != null && rate.awayScore != null) {
      parts.push(`${rate.homeScore}:${rate.awayScore}`);
    }
    return parts.length ? parts.join(" · ") : null;
  }

  if (rate.wcCommenceTime) {
    return `Старт ${formatCouponKickoff(rate.wcCommenceTime)}`;
  }

  return null;
}

export function getCouponTeamsLine(rate: Rate): string {
  if (rate.homeTeam && rate.awayTeam) {
    return `${rate.homeTeam} — ${rate.awayTeam}`;
  }
  return rate.eventName ?? "Матч";
}

export function formatCouponWinLine(
  stake: number,
  coef: number,
  currencySymbol: string,
): string | null {
  if (!Number.isFinite(stake) || stake <= 0 || !Number.isFinite(coef) || coef <= 0) {
    return null;
  }
  const win = stake * coef;
  const stakeFmt = Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2 }).format(stake);
  const winFmt = Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2 }).format(win);
  return `${stakeFmt}${currencySymbol} → ${winFmt}${currencySymbol}`;
}

export function getCouponMatchHref(rate: Rate): string {
  if (rate.source === "wc-odds" || rate.wcPick) {
    return buildWcGameHref({
      id: rate.eventId || "",
      homeTeam: rate.homeTeam || "",
      awayTeam: rate.awayTeam || "",
    });
  }
  const gameId = rate.parentEventId || rate.eventId;
  return gameId ? `/game/${gameId}` : "/line/soccer";
}

export function truncateLeagueName(name: string, maxLen = 42): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}
