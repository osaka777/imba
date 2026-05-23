"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import styles from "./DetailsStyles.module.css";
import { api } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import getSymbolFromCurrency from "currency-symbol-map";
import dayjs from "dayjs";
import { FiMinus, FiPlus, FiRotateCcw } from "react-icons/fi";

type OperationType = "INCOME" | "OUTCOME";
type TabType = "all" | "INCOME" | "OUTCOME";

interface Operation {
    id: number;
    createdAt: string;
    type: OperationType;
    amount: number | string;
    currencyCode: string;
    source?: string;
    meta?: {
        betId?: number;
        betVariant?: string;
        title?: string;
        stakedTokens?: number;
        type?: string;
        accountType?: string;
    };
}

export const DetailsModal = ({ onClose }: { onClose: () => void }) => {
    const [tab, setTab] = useState<TabType>("all");

    const { data: operations, isLoading } = useQuery<Operation[]>({
        queryKey: ["operations"],
        queryFn: async () => {
            const token = getSessionClient();
            if (!token) return [];
            const { data, error } = await api.GET("/api/finance/operation", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (error) throw error;
            return data;
        },
    });

    const filteredOperations = operations?.filter((op) => {
        if (tab === "all") return true;
        return op.type === tab;
    }) ?? [];

    return (
        <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
                <div className={styles.headerRow}>
                    <div className={styles.headerTitle}>Детализация</div>
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
                    className={`${styles.tabItem} ${tab === "INCOME" ? styles.active : ""}`}
                    onClick={() => setTab("INCOME")}
                >
                    Депозиты
                </div>
                <div
                    className={`${styles.tabItem} ${tab === "OUTCOME" ? styles.active : ""}`}
                    onClick={() => setTab("OUTCOME")}
                >
                    Выводы
                </div>
            </div>

            <div className={styles.content}>
                {isLoading ? (
                    <div className={styles.loadingText}>Загрузка...</div>
                ) : !filteredOperations.length ? (
                    <div className={styles.emptyBlock}>
                        <div className={styles.emptyTitle}>Ничего нет</div>
                        <div className={styles.emptyText}>
                            У вас пока нет ни одной операции, чтоб отобразить ее
                        </div>
                    </div>
                ) : (
                    <div className={styles.operationsList}>
                        {filteredOperations.map((operation) => {
                            const currency = getSymbolFromCurrency(operation.currencyCode);
                            const amount = Intl.NumberFormat("ru-RU", {
                                minimumFractionDigits: 2,
                            }).format(Number(operation.amount));

                            // Определяем, является ли это бонусной операцией
                            const isBonusOperation = operation.source === 'BONUS_BET';
                            const isTokenBased = isBonusOperation || operation.meta?.type === 'bonus_bet' || operation.meta?.accountType === 'bonus';

                            // Функция для правильного склонения слова "жетон"
                            const getTokenText = (count: number) => {
                                if (count === 1) return 'жетон';
                                if (count >= 2 && count <= 4) return 'жетона';
                                return 'жетонов';
                            };

                            // Для бонусных выигрышей показываем количество поставленных жетонов, а не сумму выигрыша
                            let tokenCount = Number(operation.amount);

                            if (isBonusOperation && operation.type === 'INCOME') {
                                // Для новых операций используем stakedTokens из meta
                                if (operation.meta?.stakedTokens) {
                                    tokenCount = operation.meta.stakedTokens;
                                } else {
                                    // Для старых операций без stakedTokens показываем 1 жетон (стандартная ставка)
                                    tokenCount = 1;
                                }
                            }

                            const displayAmount = isBonusOperation && isTokenBased
                                ? `${tokenCount} ${getTokenText(tokenCount)}`
                                : `${amount}${currency}`;

                            // Определяем тип операции для отображения
                            const getOperationType = () => {
                                if (isBonusOperation) {
                                    if (operation.type === "INCOME") {
                                        // Проверяем, является ли это возвратом бонусной ставки
                                        if (operation.meta?.type === 'bonus_bet_return') {
                                            return "Бонус возврат";
                                        }
                                        return "Бонус выигрыш";
                                    } else if (operation.type === "OUTCOME") {
                                        return "Бонус ставка";
                                    }
                                }
                                return operation.type === "INCOME" ? "Пополнение" : "Списание";
                            };

                            const operationDate = dayjs(operation.createdAt).format(
                                "DD.MM.YY / HH:mm"
                            );
                            return (
                                <div className={styles.operationItem} key={operation.id}>
                                    <div className={styles.operationIcon}>
                                        {operation.type === "INCOME" ? (
                                            <>
                                                {operation.meta?.type === 'bonus_bet_return' ? (
                                                    <FiRotateCcw className="stroke-blue-500" />
                                                ) : (
                                            <FiPlus className="stroke-green-400" />
                                                )}
                                            </>
                                        ) : (
                                            <FiMinus className="stroke-red-600" />
                                        )}
                                    </div>
                                    <div className={styles.operationInfo}>
                                        <div className={styles.operationRow}>
                                            <span className={styles.operationId}>{`ID: F${operation.id}`}</span>
                                            <span className={styles.operationDate}>{operationDate}</span>
                                        </div>
                                        <div className={styles.operationRow}>
                                            <span className={styles.operationAmount}>{displayAmount}</span>
                                            {operation.meta?.betId && (
                                                <span className={styles.operationBetId}>
                                                    ID ставки:{" "}
                                                    {operation.meta?.betVariant === "ORDINAR" ? "R" : "E"}
                                                    {operation.meta?.betId}
                                                </span>
                                            )}
                                        </div>
                                        <span className={styles.operationType}>
                                            {getOperationType()}
                                        </span>
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
