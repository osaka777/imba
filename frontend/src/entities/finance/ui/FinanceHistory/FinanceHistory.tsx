"use client";

import getSymbolFromCurrency from "currency-symbol-map";
import dayjs from "dayjs";
import { FiMinus, FiPlus, FiRotateCcw } from "react-icons/fi";

import { components } from "~/shared/api";
import { cn } from "~/shared/lib";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./FinanceHistory.module.css";

type FinanceHistoryProps = {
  operations: components["schemas"]["OperationDto"][] | undefined;
};

export const FinanceHistory: React.FC<FinanceHistoryProps> = ({
  operations,
}) => {
  const { t, locale } = useLocale();

  if (!operations || operations.length === 0) {
    return (
      <div className={styles.FinanceHistory}>
        <h2 className={styles.heading}>{t("deposit.financeTitle")}</h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-300">{t("deposit.financeEmpty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.FinanceHistory}>
      <h2 className={styles.heading}>{t("deposit.financeTitle")}</h2>
      {operations.map((operation) => {
        const currency = getSymbolFromCurrency(operation.currencyCode);
        const amount = Intl.NumberFormat(toIntlLocale(locale), {
          minimumFractionDigits: 2,
        }).format(Number(operation.amount));

        const operationAny = operation as any;
        const isBonusOperation = operationAny.source === "BONUS_BET";
        const isTokenBased =
          isBonusOperation
          || operationAny.meta?.type === "bonus_bet"
          || operationAny.meta?.accountType === "bonus";

        const getTokenText = (count: number) => {
          if (count === 1) return t("deposit.token1");
          if (count >= 2 && count <= 4) return t("deposit.token2");
          return t("deposit.token5");
        };

        let tokenCount = Number(operation.amount);

        if (isBonusOperation && operation.type === "INCOME") {
          if (operationAny.meta?.stakedTokens) {
            tokenCount = operationAny.meta.stakedTokens;
          } else {
            tokenCount = 1;
          }
        }

        const displayAmount =
          isBonusOperation && isTokenBased
            ? `${tokenCount} ${getTokenText(tokenCount)}`
            : `${amount}${currency}`;

        const operationDate = dayjs(operation.createdAt).format(
          "DD.MM.YY / HH:mm",
        );

        const getOperationType = () => {
          if (isBonusOperation) {
            if (operation.type === "INCOME") {
              if (operationAny.meta?.type === "bonus_bet_return") {
                return t("deposit.opBonusReturn");
              }
              return t("deposit.opBonusWin");
            }
            if (operation.type === "OUTCOME") {
              return t("deposit.opBonusBet");
            }
          }

          if (
            operationAny.source === "PAYMENT_SYSTEM"
            && operation.type === "OUTCOME"
            && operationAny.meta?.method
          ) {
            const method = operationAny.meta.method;
            if (method === "cards_kz" || method === "KAZAKHSTAN") {
              return t("deposit.opWithdrawCardKz");
            }
            if (method === "cards_ru" || method === "RUSSIA") {
              return t("deposit.opWithdrawCardRu");
            }
            if (
              method === "CARD"
              || String(method).includes("cards")
              || method === "FOREIGN"
            ) {
              return t("deposit.opWithdrawCard");
            }
            if (
              method === "CRYPTO"
              || String(method).includes("usdt")
              || method === "TRC20"
              || method === "TRON"
            ) {
              return t("deposit.opWithdrawUsdt");
            }
            return t("deposit.opWithdraw");
          }

          return operation.type === "INCOME"
            ? t("deposit.opDeposit")
            : t("deposit.opDebit");
        };

        return (
          <div className={styles.financeItem} key={operation.id}>
            <p className={cn(styles.id, "text-gray-300")}>{`ID: F${operation.id}`}</p>
            <p className={styles.date}>{operationDate}</p>
            <p className={styles.amount}>{displayAmount}</p>
            <p className={styles.operationType}>
              {operation.type === "INCOME" && (
                <>
                  {operationAny.meta?.type === "bonus_bet_return" ? (
                    <FiRotateCcw className="stroke-blue-500" />
                  ) : (
                    <FiPlus className="stroke-green-400" />
                  )}
                </>
              )}
              {operation.type === "OUTCOME" && (
                <FiMinus className="stroke-red-600" />
              )}
            </p>
            <p className="text-sm text-gray-300">{getOperationType()}</p>
            {operationAny.meta?.betId && (
              <p className="flex-1 text-right text-gray-300">
                {t("deposit.betIdLabel")}{" "}
                {operationAny.meta?.betVariant === "ORDINAR" ? "R" : "E"}
                {operationAny.meta?.betId}
              </p>
            )}
            {operationAny.source === "PAYMENT_SYSTEM"
              && operation.type === "OUTCOME"
              && operationAny.meta?.method && (
              <p className="flex-1 text-right text-gray-300">
                {t("deposit.methodLabel")} {operationAny.meta.method}
                {operationAny.meta.cardType && ` (${operationAny.meta.cardType})`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
