"use client";

import getSymbolFromCurrency from "currency-symbol-map";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiInfo, FiSmartphone, FiXCircle } from "react-icons/fi";
import { toast } from "react-toastify";

import {
  cancelWithdrawal,
  fetchUserWithdrawals,
} from "~/entities/finance/api";
import { getSessionClient } from "~/entities/user/lib";
import { KaspiLogoIcon, VisaIcon } from "~/shared/assets/icons";
import { api } from "~/shared/api";
import type { Formatters } from "~/shared/i18n/format";
import type { MessageKey } from "~/shared/i18n/messages";
import type { TranslateParams } from "~/shared/i18n/messages";
import { useFormat } from "~/shared/model/useFormat";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./DetailsStyles.module.css";

type OperationType = "INCOME" | "OUTCOME";
type TabType = "all" | "INCOME" | "OUTCOME";
type OperationStatus = "WAITING" | "SUCCESS" | "FAILED";

type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

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
  cardNumber?: string;
  wallet?: string;
  reason?: string;
  withdrawalId?: number;
  action?: string;
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

function getTokenText(count: number, t: TranslateFn) {
  if (count === 1) return t("profile.tokenWord1");
  if (count >= 2 && count <= 4) return t("profile.tokenWord2");
  return t("profile.tokenWord5");
}

function formatOperationDate(iso: string, format: Formatters) {
  return format.dateTime(iso, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

function formatOperationAmount(
  operation: Operation,
  t: TranslateFn,
  format: Formatters,
) {
  const currency = getSymbolFromCurrency(operation.currencyCode) ?? operation.currencyCode;
  const isBonusOperation = operation.source === "BONUS_BET";
  const isTokenBased =
    isBonusOperation ||
    operation.meta?.type === "bonus_bet" ||
    operation.meta?.accountType === "bonus";

  let tokenCount = Number(operation.amount);

  if (isBonusOperation && operation.type === "INCOME") {
    tokenCount = operation.meta?.stakedTokens ?? 1;
  }

  if (isBonusOperation && isTokenBased) {
    const prefix = operation.type === "INCOME" ? "+" : "−";
    return `${prefix}${tokenCount} ${getTokenText(tokenCount, t)}`;
  }

  const amount = format.number(Number(operation.amount), {
    maximumFractionDigits: operation.currencyCode === "KZT" ? 0 : 2,
    minimumFractionDigits: 0,
  });

  return operation.type === "INCOME" ? `+${amount} ${currency}` : `${amount} ${currency}`;
}

function getOperationTitle(operation: Operation, t: TranslateFn) {
  if (operation.source === "BONUS_BET") {
    if (operation.meta?.type === "bonus_bet_return") return t("profile.opBonusReturn");
    return operation.type === "INCOME" ? t("profile.opBonusWin") : t("profile.opBonusBet");
  }

  if (operation.source === "WC_BET" || operation.source === "BET") {
    return operation.type === "INCOME" ? t("profile.opBetWin") : t("profile.opBet");
  }

  if (operation.source === "PROMO") return t("profile.opPromo");
  if (operation.source === "AFFILIATE" || operation.source === "AFFILIATE_BONUS") {
    return t("profile.opAffiliate");
  }

  if (operation.source === "PAYMENT_SYSTEM") {
    if (operation.meta?.action === "withdrawal_cancelled_by_user"
      || operation.meta?.title === "Отмена вывода") {
      return t("profile.opWithdrawCancel");
    }
    return operation.type === "INCOME" ? t("profile.opTopUp") : t("profile.opWithdraw");
  }

  return operation.type === "INCOME" ? t("profile.opIncome") : t("profile.opOutcome");
}

function formatPaymentSystemLabel(raw: string | null | undefined, t: TranslateFn) {
  if (!raw) return null;

  const value = raw.toLowerCase();

  if (value.includes("kaspi")) return "Kaspi Pay";
  if (value.includes("yandex")) return t("profile.payYandex");
  if (value.includes("sberbank") || value.includes("sber")) return t("profile.paySber");
  if (value.includes("kzt_foreign")) return t("profile.payBankCard");
  if (value.includes("rub_foreign")) return t("profile.payBankCardRub");
  if (value.includes("nirvana")) return "Nirvana Pay";
  if (value.includes("visa")) return "Visa";
  if (value.includes("usdt") || value.includes("crypto")) return t("profile.payCrypto");
  if (value.includes("phone") || value.includes("mobile")) return t("profile.payPhone");
  if (value.includes("card") || value.includes("cards")) return t("profile.payBankCard");

  return raw.replace(/_/g, " ");
}

function getPaymentMethodLabel(operation: Operation, t: TranslateFn) {
  const meta = operation.meta;
  const rawMethod = meta?.paymentSystem ?? meta?.method ?? null;

  if (meta?.title === "ADMIN TOPUP") return t("profile.adminTopup");
  if (meta?.title === "ADMIN WITHDRAW") return t("profile.adminWithdraw");

  if (operation.source === "PAYMENT_SYSTEM" && rawMethod) {
    return formatPaymentSystemLabel(rawMethod, t);
  }

  if (rawMethod) {
    return formatPaymentSystemLabel(rawMethod, t);
  }

  return null;
}

function getPaymentMethodHint(operation: Operation, t: TranslateFn) {
  if (operation.meta?.cardMask) return operation.meta.cardMask;
  if (operation.meta?.wallet) return operation.meta.wallet;

  if (operation.meta?.betId) {
    const prefix = operation.meta.betVariant === "ORDINAR" ? "R" : "E";
    return t("profile.betIdHint", { id: `${prefix}${operation.meta.betId}` });
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

  if (rawMethod.includes("yandex")) {
    return (
      <Image
        alt=""
        aria-hidden
        className={styles.methodIconImage}
        height={24}
        src="/yandex-bank.png"
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

function getStatusLabel(status: OperationStatus | undefined, t: TranslateFn) {
  if (status === "FAILED") return t("profile.financeStatusCancelled");
  if (status === "WAITING") return t("profile.financeStatusProcessing");
  return null;
}

function getStatusHint(operation: Operation, t: TranslateFn) {
  if (operation.status === "FAILED") {
    return operation.meta?.reason ?? t("profile.financeRetryHint");
  }
  return null;
}

export const DetailsModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useLocale();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>("all");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

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

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["user-withdrawals"],
    queryFn: fetchUserWithdrawals,
  });

  const pendingWithdrawalIds = useMemo(() => {
    const ids = new Set<number>();
    for (const w of withdrawals) {
      if (String(w.status).toUpperCase() === "WAITING") ids.add(Number(w.id));
    }
    return ids;
  }, [withdrawals]);

  const cancelMutation = useMutation({
    mutationFn: cancelWithdrawal,
    onSuccess: async () => {
      toast.success(t("profile.financeCancelWithdrawOk"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
        queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    },
    onError: (err: Error) => {
      toast.error(err.message || t("profile.financeCancelWithdrawFail"));
    },
    onSettled: () => setCancellingId(null),
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
          {t("profile.financeTitle")}
        </h2>
        <button
          aria-label={t("profile.closeAria")}
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
          {t("common.all")}
        </button>
        <button
          className={`${styles.tabItem} ${tab === "INCOME" ? styles.tabItem_active : ""}`}
          onClick={() => setTab("INCOME")}
          type="button"
        >
          {t("profile.financeTabDeposits")}
        </button>
        <button
          className={`${styles.tabItem} ${tab === "OUTCOME" ? styles.tabItem_active : ""}`}
          onClick={() => setTab("OUTCOME")}
          type="button"
        >
          {t("profile.financeTabWithdrawals")}
        </button>
      </div>

      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.stateText}>{t("profile.financeLoading")}</div>
        ) : !filteredOperations.length ? (
          <div className={styles.emptyBlock}>
            <p className={styles.emptyTitle}>{t("profile.financeEmptyTitle")}</p>
            <p className={styles.emptyText}>{t("profile.financeEmptyText")}</p>
          </div>
        ) : (
          <div className={styles.operationsList}>
            {filteredOperations.map((operation) => {
              const statusLabel = getStatusLabel(operation.status, t);
              const statusHint = getStatusHint(operation, t);
              const title = getOperationTitle(operation, t);
              const methodLabel = getPaymentMethodLabel(operation, t);
              const hint = getPaymentMethodHint(operation, t);
              const isFailed = operation.status === "FAILED";
              const withdrawalId = Number(operation.meta?.withdrawalId);
              const canCancel =
                operation.type === "OUTCOME"
                && operation.source === "PAYMENT_SYSTEM"
                && Number.isFinite(withdrawalId)
                && withdrawalId > 0
                && pendingWithdrawalIds.has(withdrawalId);
              const isCancelling = cancellingId === withdrawalId && cancelMutation.isPending;

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
                          {formatOperationAmount(operation, t, format)}
                        </p>
                      </div>

                      <div className={styles.operationFooter}>
                        <div className={styles.operationMeta}>
                          {methodLabel && (
                            <p className={styles.methodSubtitle}>{methodLabel}</p>
                          )}
                          {hint && <p className={styles.methodHint}>{hint}</p>}
                          {canCancel ? (
                            <p className={styles.statusRow}>
                              <FiXCircle aria-hidden className={styles.statusIcon} />
                              {t("profile.financeStatusProcessing")}
                            </p>
                          ) : (
                            statusLabel && (
                              <p className={styles.statusRow}>
                                <FiXCircle aria-hidden className={styles.statusIcon} />
                                {statusLabel}
                              </p>
                            )
                          )}
                        </div>
                        <p className={styles.date}>{formatOperationDate(operation.createdAt, format)}</p>
                      </div>

                      {canCancel && (
                        <button
                          className={styles.cancelWithdrawBtn}
                          disabled={cancelMutation.isPending}
                          onClick={() => {
                            setCancellingId(withdrawalId);
                            cancelMutation.mutate(withdrawalId);
                          }}
                          type="button"
                        >
                          {isCancelling
                            ? t("profile.financeCancellingWithdraw")
                            : t("profile.financeCancelWithdraw")}
                        </button>
                      )}
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
