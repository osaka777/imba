"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";

import styles from "./BetsHistoryStyles.module.css";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { createTitleForBet } from "~/entities/bet/lib";
import { getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { mapWcBetsForHistory } from "~/entities/wc-odds/lib/mapWcBetsForHistory";
import { mapWcExpressForHistory } from "~/entities/wc-odds/lib/mapWcExpressForHistory";
import type { MessageKey } from "~/shared/i18n/messages";
import type { TranslateParams } from "~/shared/i18n/messages";
import { useFormat } from "~/shared/model/useFormat";
import { useLocale } from "~/shared/model/useLocale";

import { components } from "~/shared/api";

type BetStatus = "PENDING" | "WIN" | "LOSE" | "RETURN" | "CASHOUT";
type TabType = "all" | "express" | "ordinar";
type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

interface BetsResponse {
    express: ExpressBetDto[];
    ordinar: BetDto[];
}

export const BetsHistoryModal = ({
    onClose,
    accountNumber = "12345678"
}: {
    onClose: () => void;
    accountNumber?: string;
}) => {
    const { t } = useLocale();
    const format = useFormat();
    const [tab, setTab] = useState<TabType>("all");
    const router = useRouter();

    const handleBetClick = (bet: any) => {
        if (bet?.isWcBet && bet?.wcGameHref) {
            router.push(bet.wcGameHref);
            onClose();
            return;
        }
        if (bet?.isWcBet) {
            router.push("/line/soccer");
            onClose();
            return;
        }
        if (bet.game?.parentEventId) {
            router.push(`/game/${bet.game.parentEventId}`);
        }
        else if (bet.bets?.length > 0 && bet.bets[0]?.parentEventId) {
            router.push(`/game/${bet.bets[0].parentEventId}`);
        }
        onClose();
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
                    console.error('Error fetching bets:', error);
                    return { express: [], ordinar: [] };
                }

                return (data as any) || { express: [], ordinar: [] };
            } catch (error) {
                console.error('Error in BetsHistoryModal queryFn:', error);
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

    const mergedBets: BetsResponse = {
        express: [...(bets?.express || []), ...mapWcExpressForHistory(wcGrouped.express)],
        ordinar: [...(bets?.ordinar || []), ...mapWcBetsForHistory(wcGrouped.ordinar)],
    };

    const filteredBets = (mergedBets
        ? tab === "all" ? [...(mergedBets.express || []), ...(mergedBets.ordinar || [])] :
            tab === "express" ? mergedBets.express || [] :
                mergedBets.ordinar || []
        : []
    ).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const getEventName = (bet: any): string => {
        if (bet.isWcBet) {
            return bet.eventName;
        }
        if (bet.bets?.length > 0) {
            const firstBet = bet.bets[0];
            const eventName = firstBet?.eventName || firstBet?.game?.eventName || t("coupon.expressFromEvents", { count: bet.bets.length });
            const sport = firstBet?.sport || firstBet?.game?.sport;
            const league = firstBet?.leagueName || firstBet?.game?.leagueName;

            let displayText = eventName;
            if (sport || league) {
                const additionalInfo = [sport, league].filter(Boolean).join(' • ');
                displayText = `${eventName} (${additionalInfo})`;
            }
            return displayText;
        } else if (bet.game || bet.eventName) {
            const eventName = bet.eventName || bet.game?.eventName || t("coupon.eventDefault");
            const sport = bet.sport || bet.game?.sport;
            const league = bet.leagueName || bet.game?.leagueName;

            let displayText = eventName;
            if (sport || league) {
                const additionalInfo = [sport, league].filter(Boolean).join(' • ');
                displayText = `${eventName} (${additionalInfo})`;
            }
            return displayText;
        }
        return t("coupon.eventDefault");
    };

    const getChoice = (bet: any): string => {
        if (bet.isWcBet) {
            const info = bet.betInfo || t("coupon.betLabel");
            if (bet.score && !/сч[ёе]т\s*:/i.test(info) && !/score\s*:/i.test(info)) {
                return `${info} · ${t("coupon.scoreLabel", { score: bet.score })}`;
            }
            return info;
        }
        if (bet.bets?.length > 0) {
            let choiceText = t("coupon.expressFromEvents", { count: bet.bets.length });

            const firstBet = bet.bets[0];
            const score = firstBet?.score || firstBet?.game?.score;
            if (score && score !== 'N/A' && score !== '0:0') {
                choiceText += t("coupon.scoreLabel", { score });
            }

            return choiceText;
        } else if (bet.betInfo) {
            const score = bet.score || bet.game?.score;
            if (score && score !== 'N/A' && score !== '0:0') {
                return t("coupon.scoreLabel", { score });
            }

            return createTitleForBet(bet.betInfo) || t("coupon.betLabel");
        }
        return bet.betType || t("coupon.betLabel");
    };

    const formatBetDate = (createdAt: string) =>
        format.dateTime(createdAt, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).replace(",", " •");

    return (
        <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
                <div className={styles.headerRow}>
                    <div className={styles.headerTitle}>{t("coupon.historyTitle")}</div>
                    <div className={styles.headerAccount}>
                        <span>{t("profile.accountId", { id: accountNumber })}</span>
                        <button className={styles.closeButton} onClick={onClose}>
                            <svg width="18" height="18" viewBox="0 0 320 512" aria-hidden="true">
                                <path
                                    fill="#99A2AD"
                                    d="M207.6 256l107.72-107.72c6.23-6.23 6.23-16.34 0-22.58l-25.03-25.03c-6.23-6.23-16.34-6.23-22.58 0L160 208.4 52.28 100.68c-6.23-6.23-16.34-6.23-22.58 0L4.68 125.7c-6.23 6.23-6.23 16.34 0 22.58L112.4 256 4.68 363.72c-6.23 6.23-6.23 16.34 0 22.58l25.03 25.03c6.23 6.23 16.34 6.23 22.58 0L160 303.6l107.72 107.72c6.23 6.23 16.34 6.23 22.58 0l25.03-25.03c6.23-6.23 6.23-16.34 0-22.58L207.6 256z"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.tabs}>
                <div
                    className={`${styles.tabItem} ${tab === "all" ? styles.active : ""}`}
                    onClick={() => setTab("all")}
                >
                    {t("coupon.all")}
                </div>
                <div
                    className={`${styles.tabItem} ${tab === "express" ? styles.active : ""}`}
                    onClick={() => setTab("express")}
                >
                    {t("coupon.express")}
                </div>
                <div
                    className={`${styles.tabItem} ${tab === "ordinar" ? styles.active : ""}`}
                    onClick={() => setTab("ordinar")}
                >
                    {t("coupon.ordinar")}
                </div>
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
                            const betType = (bet as any).betVariant === 'EXPRESS' ? 'express' : 'ordinar';
                            const uniqueKey = `${betType}-${bet.id}-${index}`;
                            const statusName = getBetStatusName(bet.status, getGameStatus(bet), t);

                            return (
                                <div
                                    className={`${styles.betItem} ${styles.clickable}`}
                                    key={uniqueKey}
                                    onClick={() => handleBetClick(bet)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.betHeader}>
                                        <div className={styles.betHeaderLeft}>
                                            <span className={styles.betDate}>
                                                {formatBetDate(bet.createdAt)}
                                            </span>
                                            {tab === "all" && (
                                                <span className={styles.betType}>
                                                    {(bet as any).isWcBet
                                                        ? t("coupon.ordinar")
                                                        : (bet as any).betVariant === 'EXPRESS' ? t("coupon.express") : t("coupon.ordinar")}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.betStatus}>
                                            <span className={
                                                bet.status === "WIN" || bet.status === "CASHOUT" ? styles.statusWin :
                                                    bet.status === "LOSE" ? styles.statusLose :
                                                        bet.status === "PENDING" ? styles.statusPending :
                                                            styles.statusReturn
                                            }>
                                                {statusName}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.betContent}>
                                        <div className={styles.betEvent}>{getEventName(bet)}</div>
                                        <div className={styles.betChoice}>
                                            {statusName !== t("coupon.historySettling") ? getChoice(bet) : t("coupon.eventFinished")}
                                        </div>
                                    </div>

                                    <div className={styles.betFooter}>
                                        <div className={styles.betCoefficient}>
                                            <span className={styles.betCoefficientLabel}>{t("coupon.coefficientShort")}</span>
                                            <span className={styles.betCoefficientValue}>{bet.cf || 'N/A'}</span>
                                        </div>
                                        <div className={styles.betAmount}>
                                            <span className={styles.betAmountLabel}>
                                                {bet.status === "WIN"
                                                    ? t("coupon.payoutWin")
                                                    : bet.status === "CASHOUT"
                                                      ? t("coupon.payoutCashout")
                                                      : bet.status === "RETURN"
                                                        ? t("coupon.payoutReturn")
                                                        : t("coupon.payoutStake")}
                                            </span>
                                            <span className={styles.betAmountValue}>
                                                {getPayoutDisplay(bet)} {getSymbolFromCurrency(bet.currencyCode) || bet.currencyCode}
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

function getPayoutDisplay(bet: any): string {
    const stake = Number(bet.amount) || 0;

    if (bet.status === "WIN" || bet.status === "CASHOUT") {
        const payout = bet.payout != null
            ? Number(bet.payout)
            : stake * (Number(bet.cf) || 1);
        return Number.isFinite(payout) ? String(Math.round(payout)) : String(stake);
    }

    return String(Math.round(stake));
}

function isGameFinished(game: any): boolean {
    if (!game) return false;

    if (game.finale === true) return true;

    if (game.status === "FINISHED" || game.status === 2) return true;
    if (game.status === "CANCELED" || game.status === 3) return true;

    if (game.timer && (game.timer.includes("FT") || game.timer.includes("Final"))) return true;

    if (game.canceled === true) return true;

    if (game.startTime) {
        const gameStart = new Date(game.startTime);
        const now = new Date();
        const hoursElapsed = (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed > 3 && game.status !== "IN_PROGRESS") return true;
    }

    return false;
}

function getGameStatus(bet: any): { isFinished: boolean; game: any } {
    if (bet.isWcBet) {
        return { isFinished: Boolean(bet.eventCompleted), game: null };
    }
    if (bet.bets && bet.bets.length > 0) {
        const allGamesFinished = bet.bets.every((subBet: any) =>
            isGameFinished(subBet.game)
        );
        return { isFinished: allGamesFinished, game: bet.bets[0]?.game };
    }

    return {
        isFinished: isGameFinished(bet.game),
        game: bet.game
    };
}

function getBetStatusName(
    status: BetStatus,
    gameStatus: { isFinished: boolean; game: any } | undefined,
    t: TranslateFn,
): string {
    switch (status) {
        case "PENDING":
            if (gameStatus?.isFinished) {
                return t("coupon.historySettling");
            }
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
            return t("coupon.statusUnknown");
    }
}
