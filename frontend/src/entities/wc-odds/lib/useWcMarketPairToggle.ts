"use client";

import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Rates } from "~/entities/bet";
import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import {
  buildWcMarketRate,
  isWcMarketBettable,
  isWcOddsRate,
  wcMarketId,
} from "~/entities/wc-odds/lib/wcRate";

export function useWcMarketPairToggle(
  event: WcEventDetail,
  group: WcMarketGroup,
  bettingOpen: boolean,
) {
  const [rates, setRates] = useLocalStorage<Rates>("rates", [], {
    initializeWithValue: false,
  });

  const toggle = useCallback(
    (outcome: WcMarketOutcome) => {
      if (!bettingOpen || !isWcMarketBettable(group.marketKey, outcome.outcomeKey)) return;

      const market = wcMarketId(group.marketKey, outcome.outcomeKey, group.key);

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
    },
    [bettingOpen, event, group.key, group.label, group.marketKey, setRates],
  );

  const isSelected = useCallback(
    (outcome?: WcMarketOutcome) => {
      if (!outcome) return false;
      const market = wcMarketId(group.marketKey, outcome.outcomeKey, group.key);
      return rates.some((r) => isWcOddsRate(r) && r.eventId === event.id && r.market === market);
    },
    [event.id, group.key, group.marketKey, rates],
  );

  const isBettable = useCallback(
    (outcome?: WcMarketOutcome) =>
      !!outcome
      && bettingOpen
      && !outcome.suspended
      && Number.isFinite(outcome.price)
      && outcome.price > 1
      && isWcMarketBettable(group.marketKey, outcome.outcomeKey),
    [bettingOpen, group.marketKey],
  );

  return { toggle, isSelected, isBettable };
}
