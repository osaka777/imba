import type { Rate, Rates } from "../../types";
import { BetItem } from "./BetItem";
import styles from "./BetTab.module.css";

type BetListProps = {
  deleteButtonOnClickHandler: (item: Rate) => void;
  rates: Rates;
  variant: "express" | "ordinar" | "series";
  stakeAmount?: number;
  currencyCode?: string;
};

export const BetList: React.FC<BetListProps> = ({
  deleteButtonOnClickHandler,
  rates,
  variant,
  stakeAmount = 0,
  currencyCode,
}) => {
  if (!rates.length) {
    return (
      <div className={styles.totalCoefficient}>
        <div className={styles.CouponTotalCoefficientRoot}>
          <div className={styles.CouponTotalCoefficientText}>
            Выберите ставку
          </div>
        </div>
      </div>
    );
  }

  const totalCf = rates.reduce((acc, rate) => acc * Number(rate.coef), 1);

  return (
    <>
      <div className={styles.betListItems}>
        {rates.map((rate, i) => (
          <BetItem
            deleteButtonOnClickHandler={deleteButtonOnClickHandler}
            key={`${rate.eventId}-${rate.market}-${i}`}
            rate={rate}
            variant={variant}
            stakeAmount={stakeAmount}
            currencyCode={currencyCode}
          />
        ))}
      </div>
      <div className={styles.totalCoefficient}>
        <div className={styles.CouponTotalCoefficientRoot}>
          <div className={styles.oddText}>
            {isNaN(totalCf) ? "-" : totalCf.toFixed(2)}
          </div>
          <div className={styles.CouponTotalCoefficientText}>
            {variant === "express" ? "Итоговый коэффициент" : "Коэффициент"}
          </div>
        </div>
      </div>
    </>
  );
};
