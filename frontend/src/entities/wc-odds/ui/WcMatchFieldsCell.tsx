"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import { AccessIcon } from "~/shared/assets";
import { usePrevious } from "~/shared/model";
import { Button } from "~/shared/ui";
import {
  buildWcRate,
  isWcOddsRate,
  WC_MARKET,
  WC_PICK_LABEL,
  type WcPick,
} from "~/entities/wc-odds/lib/wcRate";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import type { WcEvent } from "~/entities/wc-odds/api/client";

import styles from "~/entities/game/ui/TournamentTable/MatchRow.module.css";

type WcMatchFieldsCellProps = {
  event: WcEvent;
  pick: WcPick;
  value: string;
};

export function WcMatchFieldsCell({ event, pick, value }: WcMatchFieldsCellProps) {
  const market = WC_MARKET[pick];
  const bettingOpen = useWcBettingOpen(event);
  const { prevState } = usePrevious(value);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });
  const [isRateAdded, setIsRateAdded] = useState(false);

  const isAvailable = bettingOpen && value !== "--";

  const toggleRate = useCallback(() => {
    const odd = Number(value);
    if (!isAvailable || !Number.isFinite(odd)) return;

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
        buildWcRate(event, pick, odd),
      ];
    });
    window.dispatchEvent(new CustomEvent("open-coupon"));
  }, [event, isAvailable, market, pick, setRates, value]);

  useEffect(() => {
    const added = rates.some(
      (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
    );
    setIsRateAdded(added);
  }, [rates, event.id, market]);

  useEffect(() => {
    if (!isRateAdded) return;
    const odd = Number(value);
    if (!Number.isFinite(odd)) return;

    setRates((prev) => {
      const current = prev.find(
        (r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market,
      );
      if (!current) return prev;

      const nextCoef = odd.toFixed(2);
      if (current.coef === nextCoef && current.isOpen === bettingOpen) {
        return prev;
      }

      return prev.map((r) =>
        isWcOddsRate(r) && r.eventId === event.id && r.market === market
          ? buildWcRate(event, pick, odd)
          : r,
      );
    });
  }, [value, event, pick, market, isRateAdded, setRates, bettingOpen]);

  const statusClassNames = useMemo(
    () =>
      wcOddsFlashClasses(value, prevState, {
        oddFlash_up: styles.oddCell_up,
        oddFlash_down: styles.oddCell_down,
        oddCoefficient_up: styles.oddCoefficient_up,
        oddCoefficient_down: styles.oddCoefficient_down,
      }),
    [value, prevState],
  );

  return (
    <Button
      className={`${styles.oddCell} ${statusClassNames.cell} ${isRateAdded && styles.oddCell_added}`}
      data-market={market}
      disabled={!isAvailable}
      onClick={toggleRate}
    >
      {!isAvailable ? <AccessIcon className={styles.lock} /> : null}
      <p className={styles.addedGameName}>{WC_PICK_LABEL[pick]}</p>
      <p
        className={`${styles.oddCoefficient} ${statusClassNames.coef} ${isRateAdded && styles.oddCoefficient_added}`}
      >
        {value}
      </p>
    </Button>
  );
}
