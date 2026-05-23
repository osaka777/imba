import getSymbolFromCurrency from "currency-symbol-map";
import dayjs from "dayjs";
import { FiMinus, FiPlus, FiRotateCcw } from "react-icons/fi";

import { components } from "~/shared/api";
import { cn } from "~/shared/lib";

import styles from "./FinanceHistory.module.css";

type FinanceHistoryProps = {
  operations: components["schemas"]["OperationDto"][] | undefined;
};

export const FinanceHistory: React.FC<FinanceHistoryProps> = ({
  operations,
}) => {
  if (!operations || operations.length === 0) {
    return (
      <div className={styles.FinanceHistory}>
        <h2 className={styles.heading}>{`Финансовые Операции`}</h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-300">У вас пока нет финансовых операций</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.FinanceHistory}>
      <h2 className={styles.heading}>{`Финансовые Операции`}</h2>
      {operations.map((operation) => {
        const currency = getSymbolFromCurrency(operation.currencyCode);
        const amount = Intl.NumberFormat("ru-RU", {
          minimumFractionDigits: 2,
        }).format(Number(operation.amount));
        
        // Определяем, является ли это бонусной операцией
        const operationAny = operation as any;
        const isBonusOperation = operationAny.source === 'BONUS_BET';
        // Для старых операций может не быть meta.type или accountType, поэтому считаем все BONUS_BET операции жетонными
        const isTokenBased = isBonusOperation || operationAny.meta?.type === 'bonus_bet' || operationAny.meta?.accountType === 'bonus';

        // Отладочная информация для проверки возвратов
        if (operationAny.meta?.type === 'bonus_bet_return') {
          console.log('🎯 Найдена операция возврата:', {
            id: operation.id,
            type: operation.type,
            meta: operationAny.meta
          });
        }
        
                              // Для бонусных операций:
                      // - OUTCOME (ставки) показываем жетоны
                      // - INCOME (выигрыши) показываем количество жетонов, которые были поставлены
                      const getTokenText = (count: number) => {
                        if (count === 1) return 'жетон';
                        if (count >= 2 && count <= 4) return 'жетона';
                        return 'жетонов';
                      };

                      // Для бонусных выигрышей показываем количество поставленных жетонов, а не сумму выигрыша
                      let tokenCount = Number(operation.amount);
                      
                      if (isBonusOperation && operation.type === 'INCOME') {
                        // Для новых операций используем stakedTokens из meta
                        if (operationAny.meta?.stakedTokens) {
                          tokenCount = operationAny.meta.stakedTokens;
                        } else {
                          // Для старых операций без stakedTokens показываем 1 жетон (стандартная ставка)
                          tokenCount = 1;
                        }
                      }

                      const displayAmount = isBonusOperation && isTokenBased
                        ? `${tokenCount} ${getTokenText(tokenCount)}`
                        : `${amount}${currency}`;

        const operationDate = dayjs(operation.createdAt).format(
          "DD.MM.YY / HH:mm",
        );

                              // Определяем тип операции для отображения
                      const getOperationType = () => {
                        if (isBonusOperation) {
                          if (operation.type === "INCOME") {
                            // Проверяем, является ли это возвратом бонусной ставки
                            if (operationAny.meta?.type === 'bonus_bet_return') {
                              return "Бонус возврат";
                            }
                            return "Бонус выигрыш";
                          } else if (operation.type === "OUTCOME") {
                            return "Бонус ставка";
                          }
                        }
                        
                        // Для операций вывода средств показываем метод
                        if (operationAny.source === 'PAYMENT_SYSTEM' && operation.type === "OUTCOME" && operationAny.meta?.method) {
                          const method = operationAny.meta.method;
                          if (method.includes('cards')) {
                            return method === 'cards_kz' ? "Вывод на карту (КЗ)" : "Вывод на карту";
                          } else if (method.includes('usdt')) {
                            return "Вывод криптовалюты";
                          }
                          return "Вывод средств";
                        }
                        
                        return operation.type === "INCOME" ? "Пополнение" : "Списание";
                      };

        return (
          <div className={styles.financeItem} key={operation.id}>
            <p
              className={cn(styles.id, "text-gray-300")}
            >{`ID: F${operation.id}`}</p>
            <p className={styles.date}>{operationDate}</p>
            <p className={styles.amount}>{displayAmount}</p>
            <p className={styles.operationType}>
              {operation.type === "INCOME" && (
                <>
                  {operationAny.meta?.type === 'bonus_bet_return' ? (
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
            <p className="text-sm text-gray-300">
              {getOperationType()}
            </p>
            {operationAny.meta?.betId && (
              <p className="flex-1 text-right text-gray-300">
                ID ставки:{" "}
                {operationAny.meta?.betVariant === "ORDINAR" ? "R" : "E"}
                {operationAny.meta?.betId}
              </p>
            )}
            {operationAny.source === 'PAYMENT_SYSTEM' && operation.type === "OUTCOME" && operationAny.meta?.method && (
              <p className="flex-1 text-right text-gray-300">
                Метод: {operationAny.meta.method}
                {operationAny.meta.cardType && ` (${operationAny.meta.cardType})`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
