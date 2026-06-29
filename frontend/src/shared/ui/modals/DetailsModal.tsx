"use client";

import getSymbolFromCurrency from "currency-symbol-map";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiInfo, FiSmartphone, FiXCircle } from "react-icons/fi";

import { getSessionClient } from "~/entities/user/lib";
import { KaspiLogoIcon, VisaIcon } from "~/shared/assets/icons";
import { api } from "~/shared/api";

import styles from "./DetailsStyles.module.css";

type OperationType = "INCOME" | "OUTCOME";
type TabType = "all" | "INCOME" | "OUTCOME";
type OperationStatus = "WAITING" | "SUCCESS" | "FAILED";

type OperationMeta = {
  betId?: number;
  betVariant?: string;
  title?: string;
  stakedTokens?: number;
  type?: string;
  accountType?: string;
  method?: string;
  paymentSystem?: string;
  cardType?: string;
  cardMask?: string;
  wallet?: string;
  reason?: string;
};

interface Operation {
  id: number;
  createdAt: string;
  type: OperationType;
  amount: number | string;
  currencyCode: string;
  source?: string;
  status?: OperationStatus;
  meta?: OperationMeta;
}

function formatOperationDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

function formatOperationAmount(operation: Operation) {
  const currency = getSymbolFromCurrency(operation.currencyCode) ?? operation.currencyCode;
  const isBonusOperation = operation.source === "BONUS_BET";
  const isTokenBased =
    isBonusOperation ||
    operation.meta?.type === "bonus_bet" ||
    operation.meta?.accountType === "bonus";

  const getTokenText = (count: number) => {
    if (count === 1) return "жетон";
    if (count >= 2 && count <= 4) return "жетона";
    return "жетонов";
  };

  let tokenCount = Number(operation.amount);

  if (isBonusOperation && operation.type === "INCOME") {
    tokenCount = operation.meta?.stakedTokens ?? 1;
  }

  if (isBonusOperation && isTokenBased) {
    const prefix = operation.type === "INCOME" ? "+" : "−";
    return `${prefix}${tokenCount} ${getTokenText(tokenCount)}`;
  }

  const amount = Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: operation.currencyCode === "KZT" ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(Number(operation.amount));

  return operation.type === "INCOME" ? `+${amount} ${currency}` : `${amount} ${currency}`;
}

function getOperationTitle(operation: Operation) {
  if (operation.source === "BONUS_BET") {
    if (operation.meta?.type === "bonus_bet_return") return "Бонус возврат";
    return operation.type === "INCOME" ? "Бонус выигрыш" : "Бонус ставка";
  }

  if (operation.source === "WC_BET" || operation.source === "BET") {
    return operation.type === "INCOME" ? "Выигрыш по ставке" : "Ставка";
  }

  if (operation.source === "PROMO") return "Промокод";
  if (operation.source === "AFFILIATE" || operation.source === "AFFILIATE_BONUS") {
    return "Партнёрская программа";
  }

  if (operation.source === "PAYMENT_SYSTEM") {
    return operation.type === "INCOME" ? "Пополнение счёта" : "Вывод средств";
  }

  return operation.type === "INCOME" ? "Пополнение" : "Списание";
}

function formatPaymentSystemLabel(raw?: string | null) {
  if (!raw) return null;

  const value = raw.toLowerCase();

  if (value.includes("kaspi")) return "Kaspi Pay";
  if (value.includes("sberbank") || value.includes("sber")) return "Перевод из РФ";
  if (value.includes("kzt_foreign")) return "Банковская карта";
  if (value.includes("rub_foreign")) return "Банковская карта (RUB)";
  if (value.includes("nirvana")) return "Nirvana Pay";
  if (value.includes("visa")) return "Visa";
  if (value.includes("usdt") || value.includes("crypto")) return "Криптовалюта";
  if (value.includes("phone") || value.includes("mobile")) return "Перевод по номеру телефона";
  if (value.includes("card") || value.includes("cards")) return "Банковская карта";

  return raw.replace(/_/g, " ");
}

function getPaymentMethodLabel(operation: Operation) {
  const meta = operation.meta;
  const rawMethod = meta?.paymentSystem ?? meta?.method ?? null;

  if (meta?.title === "ADMIN TOPUP") return "Админ-пополнение";
  if (meta?.title === "ADMIN WITHDRAW") return "Админ-вывод";

  if (operation.source === "PAYMENT_SYSTEM" && rawMethod) {
    return formatPaymentSystemLabel(rawMethod);
  }

  if (rawMethod) {
    return formatPaymentSystemLabel(rawMethod);
  }

  return null;
}

function getPaymentMethodHint(operation: Operation) {
  if (operation.meta?.cardMask) return operation.meta.cardMask;
  if (operation.meta?.wallet) return operation.meta.wallet;

  if (operation.meta?.betId) {
    const prefix = operation.meta.betVariant === "ORDINAR" ? "R" : "E";
    return `ID ставки: ${prefix}${operation.meta.betId}`;
  }

  return null;
}

function OperationIcon({ operation }: { operation: Operation }) {
  const rawMethod = (
    operation.meta?.paymentSystem ??
    operation.meta?.method ??
    ""
  ).toLowerCase();

  if (rawMethod.includes("kaspi")) {
    return (
      <Image
        alt=""
        aria-hidden
        className={styles.methodIconImage}
        height={24}
        src={KaspiLogoIcon}
        width={24}
      />
    );
  }

  if (rawMethod.includes("sberbank") || rawMethod.includes("sber")) {
    return (
      <Image
        alt=""
        aria-hidden
        className={styles.methodIconImage}
        height={24}
        src="/sberbank.png"
        width={24}
      />
    );
  }

  if (
    rawMethod.includes("visa") ||
    rawMethod.includes("card") ||
    rawMethod.includes("cards") ||
    rawMethod.includes("foreign")
  ) {
    return <VisaIcon aria-hidden className={styles.methodIconImage} />;
  }

  if (rawMethod.includes("phone") || rawMethod.includes("mobile")) {
    return <FiSmartphone aria-hidden className={styles.methodIconFallback} />;
  }

  return (
    <span aria-hidden className={styles.methodIconFallback}>
      {operation.type === "INCOME" ? "↓" : "↑"}
    </span>
  );
}

function getStatusLabel(status?: OperationStatus) {
  if (status === "FAILED") return "Отменен";
  if (status === "WAITING") return "В обработке";
  return null;
}

function getStatusHint(operation: Operation) {
  if (operation.status === "FAILED") {
    return operation.meta?.reason ?? "Проверьте лимит и повторите платеж";
  }
  return null;
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
      return data as Operation[];
    },
  });

  const filteredOperations = useMemo(() => {
    if (!operations) return [];
    if (tab === "all") return operations;
    return operations.filter((operation) => operation.type === tab);
  }, [operations, tab]);

  return (
    <div
      aria-labelledby="details-modal-title"
      aria-modal="true"
      className={styles.detailsModal}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
    >
      <div className={styles.header}>
        <h2 className={styles.title} id="details-modal-title">
          История платежей
        </h2>
        <button
          aria-label="Закрыть"
          className={styles.closeButton}
          onClick={onClose}
          type="button"
        >
          &#x2715;
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabItem} ${tab === "all" ? styles.tabItem_active : ""}`}
          onClick={() => setTab("all")}
          type="button"
        >
          Все
        </button>
        <button
          className={`${styles.tabItem} ${tab === "INCOME" ? styles.tabItem_active : ""}`}
          onClick={() => setTab("INCOME")}
          type="button"
        >
          Депозиты
        </button>
        <button
          className={`${styles.tabItem} ${tab === "OUTCOME" ? styles.tabItem_active : ""}`}
          onClick={() => setTab("OUTCOME")}
          type="button"
        >
          Выводы
        </button>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.stateText}>Загрузка...</div>
        ) : !filteredOperations.length ? (
          <div className={styles.emptyBlock}>
            <p className={styles.emptyTitle}>Ничего нет</p>
            <p className={styles.emptyText}>
              У вас пока нет операций для отображения
            </p>
          </div>
        ) : (
          <div className={styles.operationsList}>
            {filteredOperations.map((operation) => {
              const statusLabel = getStatusLabel(operation.status);
              const statusHint = getStatusHint(operation);
              const title = getOperationTitle(operation);
              const methodLabel = getPaymentMethodLabel(operation);
              const hint = getPaymentMethodHint(operation);
              const isFailed = operation.status === "FAILED";

              return (
                <div className={styles.operationGroup} key={operation.id}>
                  <div className={styles.operationItem}>
                    <div className={styles.methodIcon}>
                      <OperationIcon operation={operation} />
                    </div>

                    <div className={styles.operationMain}>
                      <div className={styles.operationHeader}>
                        <p className={styles.methodTitle}>{title}</p>
                        <p
                          className={`${styles.amount} ${isFailed ? styles.amount_cancelled : ""}`}
                        >
                          {formatOperationAmount(operation)}
                        </p>
                      </div>

                      <div className={styles.operationFooter}>
                        <div className={styles.operationMeta}>
                          {methodLabel && (
                            <p className={styles.methodSubtitle}>{methodLabel}</p>
                          )}
                          {hint && <p className={styles.methodHint}>{hint}</p>}
                          {statusLabel && (
                            <p className={styles.statusRow}>
                              <FiXCircle aria-hidden className={styles.statusIcon} />
                              {statusLabel}
                            </p>
                          )}
                        </div>
                        <p className={styles.date}>{formatOperationDate(operation.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {statusHint && (
                    <div className={styles.infoBox}>
                      <FiInfo aria-hidden className={styles.infoIcon} />
                      <p>{statusHint}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
