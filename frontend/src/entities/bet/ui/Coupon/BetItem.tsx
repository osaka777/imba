import getSymbolFromCurrency from "currency-symbol-map";

import { convertToFixed } from "~/entities/game/lib";
import { gamesList } from "~/entities/game";
import { AccessIcon, CloseIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";

import { createTitleForBet } from "../../lib";
import {
  formatCouponWinLine,
  getCouponMatchTimeLine,
  getCouponPhaseBadge,
  getCouponTeamsLine,
} from "../../lib/formatCouponBetMeta";
import type { Rate } from "../../types";
import styles from "./BetTab.module.css";

type BetItemProps = {
  deleteButtonOnClickHandler: (item: Rate) => void;
  rate: Rate;
  variant: "express" | "ordinar" | "series";
  stakeAmount?: number;
  currencyCode?: string;
};

export const BetItem: React.FC<BetItemProps> = ({
  deleteButtonOnClickHandler,
  rate,
  variant,
  stakeAmount = 0,
  currencyCode,
}) => {
  const coefNotANumber = rate.coef === `--`;
  const outcomeTitle =
    rate.title
    || (rate.groupedMarket ? createTitleForBet(rate.groupedMarket, rate.market) : null)
    || rate.market
    || "Ставка";

  const sportMeta = rate.sport ? gamesList[rate.sport] : undefined;
  const SportIcon = sportMeta?.Icon;
  const phaseBadge = getCouponPhaseBadge(rate);
  const matchTimeLine = getCouponMatchTimeLine(rate);
  const teamsLine = getCouponTeamsLine(rate);
  const currencySymbol = currencyCode ? getSymbolFromCurrency(currencyCode) || currencyCode : "";
  const coefNum = Number(rate.coef);
  const winLine =
    variant === "ordinar" && stakeAmount > 0
      ? formatCouponWinLine(stakeAmount, coefNum, currencySymbol)
      : null;

  return (
    <div
      className={`${styles.coupon_wrapper} ${(!rate.isOpen || coefNotANumber) && styles.coupon_wrapper_lock}`}
      key={(rate.eventId || "") + (rate.market || "")}
    >
      {!rate.isOpen && <AccessIcon className={styles.lock} />}

      <div className={styles.coupon_item}>
        <div className={styles.coupon_itemHeader}>
          <div className={styles.coupon_itemMeta}>
            {SportIcon ? <SportIcon className={styles.coupon_sportIcon} /> : null}
            <span
              className={
                phaseBadge.tone === "live" ? styles.coupon_phaseLive : styles.coupon_phaseLine
              }
            >
              {phaseBadge.label}
            </span>
            {matchTimeLine ? (
              <span className={styles.coupon_timeLine}>{matchTimeLine}</span>
            ) : null}
          </div>
          <div className={styles.coefficient}>{convertToFixed(rate.coef)}</div>
        </div>

        <div className={styles.coefficient_name}>{outcomeTitle}</div>
        <p className={styles.coupon_name}>{teamsLine}</p>

        {rate.leagueName ? (
          <p className={styles.coupon_league}>{rate.leagueName}</p>
        ) : null}

        {winLine ? <p className={styles.coupon_winLine}>{winLine}</p> : null}

        {variant === "express" && ratesExpressHint(coefNum)}
      </div>

      <Button
        className={styles.closeBtn}
        onClick={() => deleteButtonOnClickHandler(rate)}
      >
        <CloseIcon className={styles.closeBtnIcon} />
      </Button>
    </div>
  );
};

function ratesExpressHint(coef: number) {
  if (!Number.isFinite(coef) || coef <= 0) return null;
  return (
    <p className={styles.coupon_expressHint}>В экспрессе · ×{coef.toFixed(2)}</p>
  );
}
