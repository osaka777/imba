import { convertToFixed } from "~/entities/game/lib";
import { CloseIcon, AccessIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";

import { createTitleForBet } from "../../lib";
import { Rate } from "../../types";
import styles from "./BetTab.module.css";

type BetItemProps = {
  deleteButtonOnClickHandler: (item: Rate) => void;
  rate: Rate;
  variant: "express" | "ordinar" | "series";
};

export const BetItem: React.FC<BetItemProps> = ({
  deleteButtonOnClickHandler,
  rate,
}) => {
  const coefNotANumber = rate.coef === `--`;

  return (
    <>
      <div
        className={`${styles.coupon_wrapper} ${(!rate.isOpen || coefNotANumber) && styles.coupon_wrapper_lock}`}
        key={(rate.eventId || '') + (rate.market || '')}
      >
        <div className={styles.coupon_item}>
          {!rate.isOpen && <AccessIcon className={styles.lock} />}
          <div className={styles.coefficient_wrapper}>
            <div className={styles.coefficient}>{convertToFixed(rate.coef)}</div>
            <div className={styles.coefficient_name}>
              {rate.title || (rate.groupedMarket ? createTitleForBet(rate.groupedMarket) : null) || rate.market || 'Ставка'}
            </div>
          </div>
          <p className={styles.coupon_name}>{rate.eventName}</p>
        </div>
        <Button
          className={styles.closeBtn}
          onClick={() => deleteButtonOnClickHandler(rate)}
        >
          <CloseIcon className={styles.closeBtnIcon} />
        </Button>
      </div>
    </>
  );
};
