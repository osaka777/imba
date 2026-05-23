import { Rate, Rates } from "../../types";
import { BetItem } from "./BetItem";
import styles from "./BetTab.module.css";

type BetListProps = {
  deleteButtonOnClickHandler: (item: Rate) => void;
  rates: Rates;
  variant: "express" | "ordinar" | "series";
};

export const BetList: React.FC<BetListProps> = ({
  deleteButtonOnClickHandler,
  rates,
  variant,
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

  const totalCf = rates.reduce((acc, rate) => {
    return acc * Number(rate.coef);
  }, 1);

  return (
    <>
      <div className={styles.betListItems}>
        {rates.map((rate, i) => (
          <BetItem
            deleteButtonOnClickHandler={deleteButtonOnClickHandler}
            key={i}
            rate={rate}
            variant={variant}
          />
        ))}
      </div>
      <div className={styles.totalCoefficient}>
        <div className={styles.CouponTotalCoefficientRoot}>
          <div className={styles.oddText}>
            {isNaN(totalCf) ? "-" : totalCf.toFixed(2)}
          </div>
          <div
            className={styles.CouponTotalCoefficientText}
          >{`Итоговый коэффициент`}</div>
        </div>
      </div>
    </>
  );
};
