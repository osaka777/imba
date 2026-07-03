import { createTitleForBet } from "~/entities/bet/lib";
import { formatCouponMoney } from "~/entities/bet/lib/formatCouponMoney";
import type { SlipRibbon } from "~/entities/bet/ui/Coupon/OpenBetSlipCard";

export type BetHistoryStatus = "PENDING" | "WIN" | "LOSE" | "RETURN" | "CASHOUT";

export function getBetNameFromApiResponse(
  bet: Record<string, unknown>,
  betIndex?: number,
): string {
  try {
    const raw = bet?.betApiResponse;
    if (!raw) return createTitleForBet(bet.betInfo as string, bet.betType as string);

    const apiResponse = typeof raw === "string" ? JSON.parse(raw) : raw;
    const list = apiResponse?.BetsContentDataList;
    if (Array.isArray(list)) {
      const dataIndex = betIndex ?? 0;
      const betData = list[dataIndex];
      if (betData?.BetName) return betData.BetName;
    }
    return createTitleForBet(bet.betInfo as string, bet.betType as string);
  } catch {
    return createTitleForBet(bet.betInfo as string, bet.betType as string);
  }
}

export function getTeamsFromApiResponse(
  bet: Record<string, unknown>,
  betIndex?: number,
): string {
  try {
    const raw = bet?.betApiResponse;
    if (raw) {
      const apiResponse = typeof raw === "string" ? JSON.parse(raw) : raw;
      const list = apiResponse?.BetsContentDataList;
      if (Array.isArray(list)) {
        const dataIndex = betIndex ?? 0;
        const betData = list[dataIndex];
        if (betData?.Teams) return betData.Teams;
      }
    }
    const game = bet.game as Record<string, unknown> | undefined;
    const team1 = game?.team1 as string | undefined;
    const team2 = game?.team2 as string | undefined;
    if (team1 && team2) return `${team1} — ${team2}`;
    return (game?.eventName as string) || "Матч";
  } catch {
    const game = bet.game as Record<string, unknown> | undefined;
    return (game?.eventName as string) || "Матч";
  }
}

export function isLegacyGameLive(
  game: Record<string, unknown> | undefined,
): boolean {
  if (!game) return false;
  const ps = game.parsedScore as { liveScore?: { active?: number } } | undefined;
  return Boolean(
    ps?.liveScore?.active
    || game.status === "LIVE"
    || game.status === "IN_PLAY"
    || game.live === true,
  );
}

export function isGameFinished(game: Record<string, unknown> | null | undefined): boolean {
  if (!game) return false;
  if (game.finale === true) return true;
  if (game.status === "FINISHED" || game.status === 2) return true;
  if (game.status === "CANCELED" || game.status === 3) return true;
  const timer = game.timer as string | undefined;
  if (timer && (timer.includes("FT") || timer.includes("Final"))) return true;
  if (game.canceled === true) return true;
  if (game.startTime) {
    const gameStart = new Date(String(game.startTime));
    const now = new Date();
    const hoursElapsed =
      (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 3 && game.status !== "IN_PROGRESS") return true;
  }
  return false;
}

export function getBetGameStatus(bet: Record<string, unknown>): {
  isFinished: boolean;
  isLive: boolean;
} {
  if (bet.isWcExpress) {
    const legs = bet.bets as Array<{
      eventCompleted?: boolean;
      score?: string;
    }>;
    const allFinished = legs.every((leg) => leg.eventCompleted);
    const anyLive = legs.some((leg) => !leg.eventCompleted && Boolean(leg.score));
    return { isFinished: allFinished, isLive: anyLive && !allFinished };
  }

  if (bet.isWcBet) {
    return {
      isFinished: Boolean(bet.eventCompleted),
      isLive: !bet.eventCompleted && Boolean(bet.score),
    };
  }

  if (Array.isArray(bet.bets) && bet.bets.length > 0) {
    const legs = bet.bets as Array<Record<string, unknown>>;
    const allFinished = legs.every((leg) =>
      isGameFinished(leg.game as Record<string, unknown> | undefined),
    );
    const anyLive = legs.some((leg) =>
      isLegacyGameLive(leg.game as Record<string, unknown> | undefined),
    );
    return { isFinished: allFinished, isLive: anyLive && !allFinished };
  }

  const game = bet.game as Record<string, unknown> | undefined;
  const finished = isGameFinished(game);
  return {
    isFinished: finished,
    isLive: isLegacyGameLive(game) && !finished,
  };
}

export function getHistoryRibbon(
  status: BetHistoryStatus,
  gameStatus: { isFinished: boolean; isLive: boolean },
): SlipRibbon {
  switch (status) {
    case "WIN":
      return { label: "Выигрыш", variant: "win" };
    case "LOSE":
      return { label: "Проигрыш", variant: "lose" };
    case "RETURN":
      return { label: "Возврат", variant: "return" };
    case "CASHOUT":
      return { label: "Продажа", variant: "win" };
    default:
      if (gameStatus.isFinished) {
        return { label: "Расчёт", variant: "settling" };
      }
      if (gameStatus.isLive) {
        return { label: "Live", variant: "live", pulse: true };
      }
      return { label: "В игре", variant: "pending" };
  }
}

export function getHistoryFooter(
  status: BetHistoryStatus,
  amount: number,
  cf: number,
  currencyCode: string,
  payoutOverride?: number,
): {
  footerRightLabel: string;
  footerRightValue: string;
  footerRightWin: boolean;
  footerRightDanger?: boolean;
} {
  const payout = amount * cf;

  switch (status) {
    case "WIN":
      return {
        footerRightLabel: "Выигрыш",
        footerRightValue: formatCouponMoney(payout, currencyCode),
        footerRightWin: true,
      };
    case "LOSE":
      return {
        footerRightLabel: "Потеряно",
        footerRightValue: formatCouponMoney(amount, currencyCode),
        footerRightWin: false,
        footerRightDanger: true,
      };
    case "RETURN":
      return {
        footerRightLabel: "Возврат",
        footerRightValue: formatCouponMoney(amount, currencyCode),
        footerRightWin: false,
      };
    case "CASHOUT":
      return {
        footerRightLabel: "Продажа",
        footerRightValue: formatCouponMoney(payoutOverride ?? amount * cf, currencyCode),
        footerRightWin: true,
      };
    default:
      return {
        footerRightLabel: "Возм. выигрыш",
        footerRightValue: formatCouponMoney(payout, currencyCode),
        footerRightWin: true,
      };
  }
}
