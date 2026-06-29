import type { WcBet } from "~/entities/wc-odds/api/client";
import {
  formatWcOpenBetScoreLine,
  getLegacyOpenBetScoreLine,
} from "~/entities/bet/lib/openBetScoreLine";

export function getWcOpenBetScoreDisplay(bet: WcBet): {
  main: string | null;
  detail: string | null;
} {
  const { event } = bet;
  const main =
    event.parsedScore?.text?.currentScore
    ?? (event.homeScore != null && event.awayScore != null
      ? `${event.homeScore}:${event.awayScore}`
      : null);

  const fullLine = formatWcOpenBetScoreLine(event);
  let detail = fullLine;

  if (main && fullLine.includes(main)) {
    detail = fullLine.replace(main, "").replace(/^[\s·]+|[\s·]+$/g, "").trim() || null;
  }

  if (detail === main) detail = null;

  return { main, detail: detail || (main ? null : fullLine) };
}

export function getLegacyOpenBetScoreDisplay(game: {
  parsedScore?: {
    text?: { currentScore?: string; time?: string };
    liveScore?: { active?: number };
  } | null;
  status?: string;
  live?: boolean;
  time?: string;
  score?: string;
} | null | undefined): { main: string | null; detail: string | null } {
  const fullLine = getLegacyOpenBetScoreLine(game);
  const psText = game?.parsedScore?.text;
  const main =
    psText?.currentScore
    ?? (game?.score && game.score !== "0-0"
      ? game.score.split(" ")[0].split("(")[0].trim().replace("-", ":")
      : null);

  if (!main) return { main: null, detail: fullLine };

  let detail = fullLine;
  if (fullLine.includes(main)) {
    detail = fullLine.replace(main, "").replace(/^[\s·:]+|[\s·:]+$/g, "").trim();
  }
  if (detail === main || !detail) detail = null;

  return { main, detail };
}
