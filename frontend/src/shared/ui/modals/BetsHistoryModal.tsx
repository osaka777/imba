"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useRouter } from "next/navigation";
import getSymbolFromCurrency from "currency-symbol-map";
import styles from "./BetsHistoryStyles.module.css";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { createTitleForBet } from "~/entities/bet/lib";
import { getMyWcBets } from "~/entities/wc-odds/api/getMyWcBets";
import { mapWcBetsForHistory } from "~/entities/wc-odds/lib/mapWcBetsForHistory";

type BetStatus = "PENDING" | "WIN" | "LOSE" | "RETURN";
type TabType = "all" | "express" | "ordinar";

import { components } from "~/shared/api";

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
        // Для обычной ставки
        if (bet.game?.parentEventId) {
            router.push(`/game/${bet.game.parentEventId}`);
        }
        // Для экспресс-ставки - переходим к первой игре
        else if (bet.bets?.length > 0 && bet.bets[0]?.parentEventId) {
            router.push(`/game/${bet.bets[0].parentEventId}`);
        }
        // Закрываем модальное окно после клика
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
        refetchInterval: 30000, // Обновляем каждые 30 секунд
        refetchIntervalInBackground: true,
    });

    const { data: wcBets = [], isLoading: wcLoading } = useQuery({
        queryKey: ["wc-bets", "all"],
        queryFn: () => getMyWcBets(),
        refetchInterval: 30000,
        refetchIntervalInBackground: true,
    });

    const mergedBets: BetsResponse = {
        express: bets?.express || [],
        ordinar: [...(bets?.ordinar || []), ...mapWcBetsForHistory(wcBets)],
    };

    const filteredBets = (mergedBets
        ? tab === "all" ? [...(mergedBets.express || []), ...(mergedBets.ordinar || [])] :
            tab === "express" ? mergedBets.express || [] :
                mergedBets.ordinar || []
        : []
    ).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Helper functions to get event name and choice
    const getEventName = (bet: any): string => {
        if (bet.isWcBet) {
            return bet.eventName;
        }
        if (bet.bets?.length > 0) {
            // Express bet - show first bet's event or generic name
            const firstBet = bet.bets[0];
            const eventName = firstBet?.eventName || firstBet?.game?.eventName || `Экспресс из ${bet.bets.length} событий`;
            const sport = firstBet?.sport || firstBet?.game?.sport;
            const league = firstBet?.leagueName || firstBet?.game?.leagueName;

            // Формируем строку с дополнительной информацией
            let displayText = eventName;
            if (sport || league) {
                const additionalInfo = [sport, league].filter(Boolean).join(' • ');
                displayText = `${eventName} (${additionalInfo})`;
            }
            return displayText;
        } else if (bet.game || bet.eventName) {
            // Ordinary bet - используем новые поля из backend
            const eventName = bet.eventName || bet.game?.eventName || 'Событие';
            const sport = bet.sport || bet.game?.sport;
            const league = bet.leagueName || bet.game?.leagueName;

            // Формируем строку с дополнительной информацией
            let displayText = eventName;
            if (sport || league) {
                const additionalInfo = [sport, league].filter(Boolean).join(' • ');
                displayText = `${eventName} (${additionalInfo})`;
            }
            return displayText;
        }
        return 'Событие';
    };

    const getChoice = (bet: any): string => {
        if (bet.isWcBet) {
            const info = bet.betInfo || "Ставка";
            if (bet.score && !/сч[ёе]т\s*:/i.test(info)) {
                return `${info} · Счёт: ${bet.score}`;
            }
            return info;
        }
        if (bet.bets?.length > 0) {
            // Express bet - show number of events with score info if available
            let choiceText = `Экспресс из ${bet.bets.length} событий`;

            // Добавляем информацию о счете первого события, если доступна
            const firstBet = bet.bets[0];
            const score = firstBet?.score || firstBet?.game?.score;
            if (score && score !== 'N/A' && score !== '0:0') {
                choiceText += `Счёт: ${score}`;
            }

            return choiceText;
        } else if (bet.betInfo) {
            // Ordinary bet - use createTitleForBet and add score info
            let choiceText = '';

            const score = bet.score || bet.game?.score;
            if (score && score !== 'N/A' && score !== '0:0') {
                choiceText += `Счёт: ${score}`;
            }

            return choiceText;
        }
        return bet.betType || 'Ставка';
    };

    return (
        <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
                <div className={styles.headerRow}>
                    <div className={styles.headerTitle}>История ставок</div>
                    <div className={styles.headerAccount}>
                        <span>Счет #{accountNumber}</span>
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
                    Всё
                </div>
                <div
                    className={`${styles.tabItem} ${tab === "express" ? styles.active : ""}`}
                    onClick={() => setTab("express")}
                >
                    Экспресс
                </div>
                <div
                    className={`${styles.tabItem} ${tab === "ordinar" ? styles.active : ""}`}
                    onClick={() => setTab("ordinar")}
                >
                    Ординар
                </div>
            </div>

            <div className={styles.content}>
                {isLoading || wcLoading ? (
                    <div className={styles.loadingText}>Загрузка ставок...</div>
                ) : !filteredBets.length ? (
                    <div className={styles.emptyBlock}>
                        <div className={styles.emptyTitle}>Ничего нет</div>
                        <div className={styles.emptyText}>
                            У вас пока нет ни одной ставки, чтоб отобразить ее
                        </div>
                    </div>
                ) : (
                    <div className={styles.operationsList}>
                        {filteredBets.map((bet, index) => {
                            // Создаем уникальный ключ на основе типа ставки, ID и индекса
                            const betType = (bet as any).betVariant === 'EXPRESS' ? 'express' : 'ordinar';
                            const uniqueKey = `${betType}-${bet.id}-${index}`;

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
                                                {format(new Date(bet.createdAt), "dd.MM.yyyy • HH:mm", { locale: ru })}
                                            </span>
                                            {tab === "all" && (
                                                <span className={styles.betType}>
                                                    {(bet as any).isWcBet
                                                        ? "Ординар"
                                                        : (bet as any).betVariant === 'EXPRESS' ? "Экспресс" : "Ординар"}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.betStatus}>
                                            <span className={
                                                bet.status === "WIN" ? styles.statusWin :
                                                    bet.status === "LOSE" ? styles.statusLose :
                                                        bet.status === "PENDING" ? styles.statusPending :
                                                            styles.statusReturn
                                            }>
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
                                            <span className={styles.betCoefficientValue}>{bet.cf || 'N/A'}</span>
                                        </div>
                                        <div className={styles.betAmount}>
                                            <span className={styles.betAmountLabel}>
                                                {bet.status === "WIN" ? "Выигрыш:" : bet.status === "RETURN" ? "Возврат:" : "Ставка:"}
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

    if (bet.status === "WIN") {
        // WC bets carry an exact payout; legacy bets fall back to stake × coef.
        const payout = bet.payout != null
            ? Number(bet.payout)
            : stake * (Number(bet.cf) || 1);
        return Number.isFinite(payout) ? String(Math.round(payout)) : String(stake);
    }

    // LOSE / PENDING / RETURN — show the stake itself.
    return String(Math.round(stake));
}

function isGameFinished(game: any): boolean {
    if (!game) return false;

    // Проверяем finale флаг (самый надежный индикатор)
    if (game.finale === true) return true;

    // Проверяем статус игры
    if (game.status === "FINISHED" || game.status === 2) return true;
    if (game.status === "CANCELED" || game.status === 3) return true;

    // Проверяем таймер игры
    if (game.timer && (game.timer.includes("FT") || game.timer.includes("Final"))) return true;

    // Проверяем флаг canceled
    if (game.canceled === true) return true;

    // Проверяем возраст игры (если игра старше 3 часов и нет активности)
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
    // Для экспресс-ставок проверяем все игры
    if (bet.bets && bet.bets.length > 0) {
        // Экспресс считается завершенным, если все игры завершены
        const allGamesFinished = bet.bets.every((subBet: any) =>
            isGameFinished(subBet.game)
        );
        return { isFinished: allGamesFinished, game: bet.bets[0]?.game };
    }

    // Для обычных ставок проверяем статус игры
    return {
        isFinished: isGameFinished(bet.game),
        game: bet.game
    };
}

function getBetStatusName(status: BetStatus, gameStatus?: { isFinished: boolean; game: any }): string {
    switch (status) {
        case "PENDING":
            // Если игра завершена, но ставка еще в статусе PENDING, показываем "Расчет"
            if (gameStatus?.isFinished) {
                return "Расчет";
            }
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
