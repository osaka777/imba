"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import { api, components } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { createTitleForBet } from "~/entities/bet/lib";
import { getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { mapWcExpressForHistory } from "~/entities/wc-odds/lib/mapWcExpressForHistory";
import { buildWcGameHref } from "~/entities/wc-odds/lib/wcSlug";
import { getWcBetLabel } from "~/entities/wc-odds/lib/wcRate";
import { prefersEnglishFallback } from "~/shared/i18n";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./BetsHistoryPage.module.css";

type BetStatus = "PENDING" | "WIN" | "LOSE" | "RETURN" | "CASHOUT";
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
  const { locale, t } = useLocale();
  const dateLocale = prefersEnglishFallback(locale) ? enUS : ru;

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

  const { data: wcGrouped = { ordinar: [], express: [] }, isLoading: wcLoading } = useQuery({
    queryKey: ["wc-bets", "all"],
    queryFn: () => getMyWcBetsGrouped(),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const wcAsOrdinar = wcGrouped.ordinar.map((bet) => ({
    id: `wc-${bet.id}`,
    wcBetId: bet.id,
    isWcBet: true,
    status: bet.status === "VOID" ? "RETURN" : bet.status,
    createdAt: bet.createdAt,
    cf: Number(bet.odds).toFixed(2),
    amount: Number(bet.stake).toFixed(0),
    currencyCode: bet.currencyCode,
    eventName: `${bet.event.homeTeam} — ${bet.event.awayTeam}`,
    betInfo: getWcBetLabel({ ...bet, sport: bet.event.sport }),
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
    express: [...(bets?.express || []), ...mapWcExpressForHistory(wcGrouped.express)],
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
        t("wc.expressEvents", { n: bet.bets.length });
      const sport = firstBet?.sport || firstBet?.game?.sport;
      const league = firstBet?.leagueName || firstBet?.game?.leagueName;
      return [eventName, [sport, league].filter(Boolean).join(" • ")]
        .filter(Boolean)
        .join(" (") + (sport || league ? ")" : "");
    } else if (bet.game || bet.eventName) {
      const eventName = bet.eventName || bet.game?.eventName || t("wc.eventDefault");
      const sport = bet.sport || bet.game?.sport;
      const league = bet.leagueName || bet.game?.leagueName;
      return [eventName, [sport, league].filter(Boolean).join(" • ")]
        .filter(Boolean)
        .join(" (") + (sport || league ? ")" : "");
    }
    return t("wc.eventDefault");
  };

  const getChoice = (bet: any): string => {
    if (bet.isWcBet) {
      return bet.betInfo || t("wc.betLabel");
    }
    if (bet.bets?.length > 0) {
      let choiceText = t("wc.expressEvents", { n: bet.bets.length });
      const score = bet.bets[0]?.score || bet.bets[0]?.game?.score;
      if (score && score !== "N/A" && score !== "0:0") {
        choiceText += t("wc.scoreColon", { score });
      }
      return choiceText;
    } else if (bet.betInfo) {
      let choiceText = "";


      const score = bet.score || bet.game?.score;
      if (score && score !== "N/A" && score !== "0:0") {
        choiceText += t("wc.scoreColon", { score });
      }
      return choiceText;
    }
    return bet.betType || t("wc.betLabel");
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitle}>{t("coupon.historyTitle")}</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabItem} ${tab === "all" ? styles.active : ""}`}
          onClick={() => setTab("all")}
        >
          {t("coupon.historyAll")}
        </button>
        <button
          className={`${styles.tabItem} ${tab === "express" ? styles.active : ""
            }`}
          onClick={() => setTab("express")}
        >
          {t("wc.express")}
        </button>
        <button
          className={`${styles.tabItem} ${tab === "ordinar" ? styles.active : ""
            }`}
          onClick={() => setTab("ordinar")}
        >
          {t("coupon.ordinar")}
        </button>
      </div>

      <div className={styles.content}>
        {isLoading || wcLoading ? (
          <div className={styles.loadingText}>{t("coupon.loadingBets")}</div>
        ) : !filteredBets.length ? (
          <div className={styles.emptyBlock}>
            <div className={styles.emptyTitle}>{t("coupon.emptyTitle")}</div>
            <div className={styles.emptyText}>
              {t("coupon.historyModalEmpty")}
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
                          locale: dateLocale,
                        })}
                      </span>
                      {tab === "all" && (
                        <span className={styles.betType}>
                          {(bet as any).isWcBet
                            ? t("coupon.ordinar")
                            : (bet as any).betVariant === "EXPRESS"
                              ? t("wc.express")
                              : t("coupon.ordinar")}
                        </span>
                      )}
                    </div>
                    <div className={styles.betStatus}>
                      <span
                        className={
                          bet.status === "WIN" || bet.status === "CASHOUT"
                            ? styles.statusWin
                            : bet.status === "LOSE"
                              ? styles.statusLose
                              : bet.status === "PENDING"
                                ? styles.statusPending
                                : styles.statusReturn
                        }
                      >
                        {getBetStatusName(bet.status, getGameStatus(bet), t)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.betContent}>
                    <div className={styles.betEvent}>{getEventName(bet)}</div>
                    <div className={styles.betChoice}>{getBetStatusName(bet.status, getGameStatus(bet), t) !== t("coupon.historySettling") ? getChoice(bet) : t("wc.finished").toUpperCase()}</div>
                  </div>

                  <div className={styles.betFooter}>
                    <div className={styles.betCoefficient}>
                      <span className={styles.betCoefficientLabel}>{t("coupon.coefficientShort")}</span>
                      <span className={styles.betCoefficientValue}>
                        {bet.cf || "N/A"}
                      </span>
                    </div>
                    <div className={styles.betAmount}>
                      <span className={styles.betAmountLabel}>
                        {bet.status === "CASHOUT" ? t("wc.cashoutSelling")+":" : t("profile.bonusHistAmount")}
                      </span>
                      <span className={styles.betAmountValue}>
                        {bet.status === "CASHOUT" && bet.payout
                          ? bet.payout
                          : bet.amount}{" "}
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
  gameStatus: { isFinished: boolean; game: any } | undefined,
  t: (key: any, params?: Record<string, string | number>, t) => string,
): string {
  switch (status) {
    case "PENDING":
      if (gameStatus?.isFinished) return t("coupon.historySettling");
      return t("coupon.historyPending");
    case "WIN":
      return t("coupon.historyWin");
    case "LOSE":
      return t("coupon.historyLose");
    case "RETURN":
      return t("coupon.historyReturn");
    case "CASHOUT":
      return t("coupon.historyCashout");
    default:
      return t("wc.betLabel");
  }
}
