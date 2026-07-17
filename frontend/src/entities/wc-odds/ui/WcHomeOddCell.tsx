"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import { usePrevious } from "~/shared/model";
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

import styles from "~/entities/wc-odds/ui/WcHomeOddCell.module.css";

type WcHomeOddCellProps = {
  event: WcEvent;
  pick: WcPick;
  value: string;
  /** Kick / cybersport dark chip styling, or the premium top-event card CTA */
  tone?: "default" | "kick" | "topcard";
};

export function WcHomeOddCell({ event, pick, value, tone = "default" }: WcHomeOddCellProps) {
  const isKick = tone === "kick";
  const isTopCard = tone === "topcard";
  const market = WC_MARKET[pick];
  const bettingOpen = useWcBettingOpen(event);
  const { prevState } = usePrevious(value);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });
  const [isRateAdded, setIsRateAdded] = useState(false);

  const isAvailable = bettingOpen && value !== "—" && value !== "--";

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

  const flash = useMemo(
    () =>
      wcOddsFlashClasses(value, prevState, {
        oddFlash_up: styles.flash_up,
        oddFlash_down: styles.flash_down,
        oddCoefficient_up: styles.coef_up,
        oddCoefficient_down: styles.coef_down,
      }),
    [value, prevState],
  );

  if (!isAvailable) {
    return (
      <span
        className={`${styles.empty} ${isKick ? styles.empty_kick : ""} ${isTopCard ? styles.empty_topcard : ""}`}
      >
        —
      </span>
    );
  }

  return (
    <button
      aria-label={`${WC_PICK_LABEL[pick]} ${value}`}
      aria-pressed={isRateAdded}
      className={`${styles.cell} ${isKick ? styles.cell_kick : ""} ${isTopCard ? styles.cell_topcard : ""} ${flash.cell ?? ""} ${isRateAdded ? styles.cell_added : ""}`}
      data-market={market}
      onClick={toggleRate}
      type="button"
    >
      <span className={styles.pick}>{WC_PICK_LABEL[pick]}</span>
      <span className={`${styles.coef} ${flash.coef ?? ""}`}>{value}</span>
    </button>
  );
}
