import type { WcParsedScore } from "~/entities/wc-odds/api/client";
import { formatWcRowLiveTime } from "~/entities/wc-odds/lib/wcLiveScore";

type WcOpenEventLike = {
  sport?: string;
  phase?: "prematch" | "live" | "finished";
  completed?: boolean;
  commenceTime: string;
  homeScore: number | null;
  awayScore: number | null;
  parsedScore?: WcParsedScore | null;
};

export function formatWcOpenBetScoreLine(event: WcOpenEventLike): string {
  const liveTime = formatWcRowLiveTime(event.parsedScore, event.sport);
  const parsedScore =
    event.parsedScore?.text?.currentScore
    ?? (event.homeScore != null && event.awayScore != null
      ? `${event.homeScore}:${event.awayScore}`
      : null);

  const isLive =
    event.phase === "live"
    || event.parsedScore?.liveScore?.active
    || (event.homeScore != null && !event.completed && Date.parse(event.commenceTime) <= Date.now());

  if (isLive) {
    const parts = ["Live"];
    if (liveTime) parts.push(liveTime);
    if (parsedScore) parts.push(parsedScore);
    return parts.join(" · ");
  }

  if (parsedScore) return `Счёт: ${parsedScore}`;

  const start = Date.parse(event.commenceTime);
  if (Number.isFinite(start) && start > Date.now()) {
    return `Старт: ${new Date(start).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Almaty",
    })}`;
  }

  if (event.completed) return "Матч завершён";
  return "До начала";
}

export function getLegacyOpenBetScoreLine(game: {
  parsedScore?: WcParsedScore | null;
  status?: string;
  live?: boolean;
  time?: string;
  score?: string;
} | null | undefined): string {
  if (!game) return "Матч не начался";

  const ps = game.parsedScore;
  const psText = ps?.text;
  const liveTime = formatWcRowLiveTime(ps, undefined);

  if (psText?.currentScore) {
    const isLive =
      ps?.liveScore?.active
      || game.status === "LIVE"
      || game.status === "IN_PLAY"
      || game.live === true;

    if (isLive) {
      const parts = ["Live"];
      if (liveTime || psText.time) parts.push(liveTime ?? psText.time ?? "");
      parts.push(psText.currentScore);
      return parts.filter(Boolean).join(" · ");
    }
    return `Счёт: ${psText.currentScore}`;
  }

  const isLive =
    game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.live === true;

  if (isLive) {
    const time = liveTime || game.time || "";
    return time ? `Live · ${time}` : "Live";
  }

  if (game.score && game.score !== "0-0") {
    const mainScore = game.score.split(" ")[0].split("(")[0].trim();
    return `Счёт: ${mainScore}`;
  }

  return "Матч не начался";
}
