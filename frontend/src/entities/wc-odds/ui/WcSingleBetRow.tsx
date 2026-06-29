"use client";

import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import { convertToFixed } from "~/entities/game/lib";
import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import {
  buildWcMarketRate,
  isWcMarketBettable,
  isWcOddsRate,
  wcMarketId,
} from "~/entities/wc-odds/lib/wcRate";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { AccessIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { usePrevious } from "~/shared/model";
import { Button } from "~/shared/ui";

import styles from "~/entities/game/ui/Match/Match.module.css";

type WcSingleBetRowProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  outcome: WcMarketOutcome;
  title: string;
  bettingOpen: boolean;
  is1X2?: boolean;
};

export function WcSingleBetRow({
  event,
  group,
  outcome,
  title,
  bettingOpen,
  is1X2,
}: WcSingleBetRowProps) {
  const market = wcMarketId(group.marketKey, outcome.outcomeKey, group.key);
  const value = outcome.price.toFixed(2);
  const { prevState } = usePrevious(value);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  const hasPrice = Number.isFinite(outcome.price) && outcome.price > 1;
  const marketBettable = isWcMarketBettable(group.marketKey, outcome.outcomeKey);
  const isBettable = bettingOpen && hasPrice && marketBettable && !outcome.suspended;
  const showLock = !isBettable;

  const isRateAdded = rates.some(
    (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
  );

  const toggleRate = useCallback(() => {
    if (!isBettable) return;

    setRates((prev) => {
      const existing = prev.find(
        (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
      );

      if (existing) {
        return prev.filter(
          (r) => !(isWcOddsRate(r) && r.eventId === event.id && r.market === market),
        );
      }

      return [
        ...prev.filter((r) => !(isWcOddsRate(r) && r.eventId === event.id)),
        buildWcMarketRate(event, outcome, group.marketKey, group.label, group.key),
      ];
    });
    window.dispatchEvent(new CustomEvent("open-coupon"));
  }, [event, group.label, group.marketKey, isBettable, market, outcome, setRates]);

  const flash = wcOddsFlashClasses(value, prevState, styles);

  return (
    <div className={cn(styles.oddsItem, showLock && styles.oddsItem_lock, is1X2 && styles.oddsItem_1x2)}>
      <Button
        className={cn(styles.odd, styles.odd_left, flash.cell, isRateAdded && styles.odd_added)}
        disabled={!isBettable}
        onClick={toggleRate}
      >
        <p className="text-sm font-medium text-black">{title}</p>
        <p className={cn(styles.oddCoef, flash.coef)}>
          {convertToFixed(value)}
          {showLock && <AccessIcon className={styles.lock} />}
        </p>
      </Button>
    </div>
  );
}
