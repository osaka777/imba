"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import { AccessIcon } from "~/shared/assets";
import { usePrevious } from "~/shared/model";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";
import type { WcEvent } from "~/entities/wc-odds/api/client";
import {
  buildWcMarketRate,
  isWcOddsRate,
  wcMarketId,
} from "~/entities/wc-odds/lib/wcRate";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";

import styles from "~/entities/game/ui/TournamentTable/MatchRow.module.css";

type WcMatchTotalCellProps = {
  event: WcEvent;
  side: "OVER" | "UNDER";
  value: string;
};

export function WcMatchTotalCell({ event, side, value }: WcMatchTotalCellProps) {
  const { t } = useLocale();
  const bettingOpen = useWcBettingOpen(event);
  const line = event.totalLine;
  const outcomeKey = line != null ? `${side}_${line}` : side;
  const market = wcMarketId("totals", outcomeKey);
  const label = side === "OVER" ? `Б ${line ?? ""}`.trim() : `М ${line ?? ""}`.trim();
  const groupLabel =
    line != null ? t("wc.totalLine", { line: String(line) }) : t("wc.totalPlain");
  const outcomeName = side === "OVER" ? `Б ${line ?? ""}`.trim() : `М ${line ?? ""}`.trim();

  const { prevState } = usePrevious(value);
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });
  const [isRateAdded, setIsRateAdded] = useState(false);

  const isAvailable =
    bettingOpen && value !== "--" && line != null && Number.isFinite(Number(value));

  const toggleRate = useCallback(() => {
    const odd = Number(value);
    if (!isAvailable || !Number.isFinite(odd) || line == null) return;

    const outcome = {
      name: outcomeName,
      price: odd,
      point: line,
      outcomeKey,
    };

    setRates((prev) => {
      const existing = prev.find(
        (rate) => isWcOddsRate(rate) && rate.eventId === event.id && rate.market === market,
      );

      if (existing) {
        return prev.filter(
          (rate) => !(isWcOddsRate(rate) && rate.eventId === event.id && rate.market === market),
        );
      }

      return [
        ...prev.filter((rate) => !(isWcOddsRate(rate) && rate.eventId === event.id)),
        buildWcMarketRate(event, outcome, "totals", groupLabel),
      ];
    });
    window.dispatchEvent(new CustomEvent("open-coupon"));
  }, [event, groupLabel, isAvailable, line, market, outcomeKey, outcomeName, setRates, value]);

  useEffect(() => {
    const added = rates.some(
      (rate) => isWcOddsRate(rate) && rate.eventId === event.id && rate.market === market,
    );
    setIsRateAdded(added);
  }, [rates, event.id, market]);

  useEffect(() => {
    if (!isRateAdded || line == null) return;

    const odd = Number(value);
    if (!Number.isFinite(odd)) return;

    setRates((prev) => {
      const current = prev.find(
        (rate) => isWcOddsRate(rate) && rate.eventId === event.id && rate.market === market,
      );
      if (!current) return prev;

      const nextCoef = odd.toFixed(2);
      if (current.coef === nextCoef && current.isOpen === bettingOpen) {
        return prev;
      }

      const outcome = {
        name: outcomeName,
        price: odd,
        point: line,
        outcomeKey,
      };

      return prev.map((rate) =>
        isWcOddsRate(rate) && rate.eventId === event.id && rate.market === market
          ? buildWcMarketRate(event, outcome, "totals", groupLabel)
          : rate,
      );
    });
  }, [
    value,
    event,
    groupLabel,
    isRateAdded,
    line,
    market,
    outcomeKey,
    outcomeName,
    setRates,
    bettingOpen,
  ]);

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
      <p className={styles.addedGameName}>{label}</p>
      <p
        className={`${styles.oddCoefficient} ${statusClassNames.coef} ${isRateAdded && styles.oddCoefficient_added}`}
      >
        {value}
      </p>
    </Button>
  );
}
