"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import { api, components } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { createTitleForBet } from "~/entities/bet/lib";
import { getMyWcBets } from "~/entities/wc-odds/api/getMyWcBets";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";

import styles from "./BetsHistoryPage.module.css";

type BetStatus = "PENDING" | "WIN" | "LOSE" | "RETURN";
type TabType = "all" | "express" | "ordinar";

type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

interface BetsResponse {
  express: ExpressBetDto[];
  ordinar: BetDto[];
}

export const BetsHistory: React.FC = () => {
  const [tab, setTab] = useState<TabType>("all");
  const router = useRouter();

  const handleBetClick = (bet: any) => {
    if (bet?.isWcBet && bet?.wcGameHref) {
      router.push(bet.wcGameHref);
      return;
    }
    if (bet?.isWcBet) {
      router.push("/line/soccer");
      return;
    }
    if (bet?.parentEventId) {
      router.push(`/game/${bet.parentEventId}`);
    } else if (bet.bets?.length > 0 && bet.bets[0]?.parentEventId) {
      router.push(`/game/${bet.bets[0].parentEventId}`);
    }
  };

  const { data: bets, isLoading } = useQuery<BetsResponse>({
    queryKey: ["bets"],
    queryFn: async (): Promise<BetsResponse> => {
      const token = await getSessionClient();
      if (!token) return { express: [], ordinar: [] };

      try {
        const { data, error } = await api.GET("/api/bet", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (error) {
          console.error("Error fetching bets:", error);
          return { express: [], ordinar: [] };
        }

        return (data as any) || { express: [], ordinar: [] };
      } catch (error) {
        console.error("Error in BetsHistory queryFn:", error);
        return { express: [], ordinar: [] };
      }
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const { data: wcBets = [], isLoading: wcLoading } = useQuery({
    queryKey: ["wc-bets", "all"],
    queryFn: () => getMyWcBets(),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const wcAsOrdinar = wcBets.map((bet) => ({
    id: `wc-${bet.id}`,
    wcBetId: bet.id,
    isWcBet: true,
    status: bet.status === "VOID" ? "RETURN" : bet.status,
    createdAt: bet.createdAt,
    cf: Number(bet.odds).toFixed(2),
    amount: Number(bet.stake).toFixed(0),
    currencyCode: bet.currencyCode,
    eventName: `${bet.event.homeTeam} — ${bet.event.awayTeam}`,
    betInfo: getWcBetLabel(bet),
    wcGameHref: bet.event.slug
      ? buildWcGameHref({
          slug: bet.event.slug,
          id: bet.event.id || "",
          homeTeam: bet.event.homeTeam,
          awayTeam: bet.event.awayTeam,
        })
      : undefined,
    betVariant: "ORDINAR",
    score:
      bet.event.homeScore != null && bet.event.awayScore != null
        ? `${bet.event.homeScore}:${bet.event.awayScore}`
        : undefined,
  }));

  const mergedBets: BetsResponse = {
    express: bets?.express || [],
    ordinar: [...(bets?.ordinar || []), ...wcAsOrdinar],
  };

  const filteredBets = (mergedBets
    ? tab === "all"
      ? [...(mergedBets.express || []), ...(mergedBets.ordinar || [])]
      : tab === "express"
        ? mergedBets.express || []
        : mergedBets.ordinar || []
    : []
  ).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // -------- Helpers --------
  const getEventName = (bet: any): string => {
    if (bet.isWcBet) {
      return bet.eventName;
    }
    if (bet.bets?.length > 0) {
      const firstBet = bet.bets[0];
      const eventName =
        firstBet?.eventName ||
        firstBet?.game?.eventName ||
        `Экспресс из ${bet.bets.length} событий`;
      const sport = firstBet?.sport || firstBet?.game?.sport;
      const league = firstBet?.leagueName || firstBet?.game?.leagueName;
      return [eventName, [sport, league].filter(Boolean).join(" • ")]
        .filter(Boolean)
        .join(" (") + (sport || league ? ")" : "");
    } else if (bet.game || bet.eventName) {
      const eventName = bet.eventName || bet.game?.eventName || "Событие";
      const sport = bet.sport || bet.game?.sport;
      const league = bet.leagueName || bet.game?.leagueName;
      return [eventName, [sport, league].filter(Boolean).join(" • ")]
        .filter(Boolean)
        .join(" (") + (sport || league ? ")" : "");
    }
    return "Событие";
  };

  const getChoice = (bet: any): string => {
    if (bet.isWcBet) {
      return bet.betInfo || "Ставка";
    }
    if (bet.bets?.length > 0) {
      let choiceText = `Экспресс из ${bet.bets.length} событий`;
      const score = bet.bets[0]?.score || bet.bets[0]?.game?.score;
      if (score && score !== "N/A" && score !== "0:0") {
        choiceText += `Счёт: ${score}`;
      }
      return choiceText;
    } else if (bet.betInfo) {
      let choiceText = "";


      const score = bet.score || bet.game?.score;
      if (score && score !== "N/A" && score !== "0:0") {
        choiceText += `Счёт: ${score}`;
      }
      return choiceText;
    }
    return bet.betType || "Ставка";
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitle}>История ставок</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabItem} ${tab === "all" ? styles.active : ""}`}
          onClick={() => setTab("all")}
        >
          Всё
        </button>
        <button
          className={`${styles.tabItem} ${tab === "express" ? styles.active : ""
            }`}
          onClick={() => setTab("express")}
        >
          Экспресс
        </button>
        <button
          className={`${styles.tabItem} ${tab === "ordinar" ? styles.active : ""
            }`}
          onClick={() => setTab("ordinar")}
        >
          Ординар
        </button>
      </div>

      <div className={styles.content}>
        {isLoading || wcLoading ? (
          <div className={styles.loadingText}>Загрузка ставок...</div>
        ) : !filteredBets.length ? (
          <div className={styles.emptyBlock}>
            <div className={styles.emptyTitle}>Ничего нет</div>
            <div className={styles.emptyText}>
              У вас пока нет ни одной ставки
            </div>
          </div>
        ) : (
          <div className={styles.operationsList}>
            {filteredBets.map((bet, index) => {
              const betType =
                (bet as any).betVariant === "EXPRESS" ? "express" : "ordinar";
              const uniqueKey = `${betType}-${bet.id}-${index}`;

              return (
                <div
                  className={`${styles.betItem} ${styles.clickable}`}
                  key={uniqueKey}
                  onClick={() => handleBetClick(bet)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={styles.betHeader}>
                    <div className={styles.betHeaderLeft}>
                      <span className={styles.betDate}>
                        {format(new Date(bet.createdAt), "dd.MM.yyyy • HH:mm", {
                          locale: ru,
                        })}
                      </span>
                      {tab === "all" && (
                        <span className={styles.betType}>
                          {(bet as any).isWcBet
                            ? "Ординар"
                            : (bet as any).betVariant === "EXPRESS"
                              ? "Экспресс"
                              : "Ординар"}
                        </span>
                      )}
                    </div>
                    <div className={styles.betStatus}>
                      <span
                        className={
                          bet.status === "WIN"
                            ? styles.statusWin
                            : bet.status === "LOSE"
                              ? styles.statusLose
                              : bet.status === "PENDING"
                                ? styles.statusPending
                                : styles.statusReturn
                        }
                      >
                        {getBetStatusName(bet.status, getGameStatus(bet))}
                      </span>
                    </div>
                  </div>

                  <div className={styles.betContent}>
                    <div className={styles.betEvent}>{getEventName(bet)}</div>
                    <div className={styles.betChoice}>{getBetStatusName(bet.status, getGameStatus(bet)) !== "Расчет" ? getChoice(bet) : 'ОКОНЧЕНА'}</div>
                  </div>

                  <div className={styles.betFooter}>
                    <div className={styles.betCoefficient}>
                      <span className={styles.betCoefficientLabel}>Кф:</span>
                      <span className={styles.betCoefficientValue}>
                        {bet.cf || "N/A"}
                      </span>
                    </div>
                    <div className={styles.betAmount}>
                      <span className={styles.betAmountLabel}>Сумма:</span>
                      <span className={styles.betAmountValue}>
                        {bet.amount}{" "}
                        {getSymbolFromCurrency(bet.currencyCode) ||
                          bet.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// -------- Helpers вынесены за пределы компонента --------

function isGameFinished(game: any): boolean {
  if (!game) return false;
  if (game.finale === true) return true;
  if (game.status === "FINISHED" || game.status === 2) return true;
  if (game.status === "CANCELED" || game.status === 3) return true;
  if (game.timer && (game.timer.includes("FT") || game.timer.includes("Final")))
    return true;
  if (game.canceled === true) return true;
  if (game.startTime) {
    const gameStart = new Date(game.startTime);
    const now = new Date();
    const hoursElapsed =
      (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 3 && game.status !== "IN_PROGRESS") return true;
  }
  return false;
}

function getGameStatus(bet: any): { isFinished: boolean; game: any } {
  if (bet.bets && bet.bets.length > 0) {
    const allGamesFinished = bet.bets.every((subBet: any) =>
      isGameFinished(subBet.game)
    );
    return { isFinished: allGamesFinished, game: bet.bets[0]?.game };
  }
  return { isFinished: isGameFinished(bet.game), game: bet.game };
}

function getBetStatusName(
  status: BetStatus,
  gameStatus?: { isFinished: boolean; game: any }
): string {
  switch (status) {
    case "PENDING":
      if (gameStatus?.isFinished) return "Расчет";
      return "В игре";
    case "WIN":
      return "Выигрыш";
    case "LOSE":
      return "Проигрыш";
    case "RETURN":
      return "Возврат";
    default:
      return "Неизвестно";
  }
}
