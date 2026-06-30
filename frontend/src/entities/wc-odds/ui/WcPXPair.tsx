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

const H2H_LABEL: Record<string, string> = {
  HOME: "П1",
  DRAW: "X",
  AWAY: "П2",
};


type WcPXPairProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  home?: WcMarketOutcome;
  draw?: WcMarketOutcome;
  away?: WcMarketOutcome;
  bettingOpen: boolean;
  /** Override button captions (e.g. double chance 1X / 12 / X2). */
  labels?: [string, string | undefined, string];
};

function PxButton({
  event,
  group,
  outcome,
  label,
  bettingOpen,
  isRateAdded,
  onToggle,
}: {
  event: WcEventDetail;
  group: WcMarketGroup;
  outcome: WcMarketOutcome;
  label: string;
  bettingOpen: boolean;
  isRateAdded: boolean;
  onToggle: () => void;
}) {
  const value = outcome.price.toFixed(2);
  const { prevState } = usePrevious(value);
  const hasPrice = Number.isFinite(outcome.price) && outcome.price > 1;
  const isBettable = bettingOpen && hasPrice && !outcome.suspended
    && isWcMarketBettable(group.marketKey, outcome.outcomeKey);
  const showLock = !isBettable && hasPrice;
  const flash = wcOddsFlashClasses(value, prevState, styles);

  return (
    <div className={cn(styles.oddsItem, showLock && styles.oddsItem_lock, styles.oddsItemPX)}>
      <Button
        className={cn(styles.odd, isRateAdded && styles.odd_added)}
        disabled={!isBettable}
        onClick={onToggle}
      >
        <p className="text-sm font-medium text-black">{label}</p>
        <p className={cn(styles.oddCoef, flash.coef)}>
          {convertToFixed(value)}
          {showLock && <AccessIcon className={styles.lock} />}
        </p>
      </Button>
    </div>
  );
}

export function WcPXPair({ event, group, home, draw, away, bettingOpen, labels }: WcPXPairProps) {
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

  if (!home || !away) return null;

  const homeLabel = labels?.[0] ?? H2H_LABEL.HOME;
  const drawLabel = labels?.[1] ?? H2H_LABEL.DRAW;
  const awayLabel = labels?.[2] ?? H2H_LABEL.AWAY;
  const homeMarket = wcMarketId(group.marketKey, home.outcomeKey, group.key);
  const drawMarket = draw ? wcMarketId(group.marketKey, draw.outcomeKey, group.key) : "";
  const awayMarket = wcMarketId(group.marketKey, away.outcomeKey, group.key);

  return (
    <>
      <PxButton
        event={event}
        group={group}
        outcome={home}
        label={homeLabel}
        bettingOpen={bettingOpen}
        isRateAdded={rates.some((r) => isWcOddsRate(r) && r.eventId === event.id && r.market === homeMarket)}
        onToggle={() => toggle(home)}
      />
      {draw ? (
        <PxButton
          event={event}
          group={group}
          outcome={draw}
          label={drawLabel}
          bettingOpen={bettingOpen}
          isRateAdded={rates.some((r) => isWcOddsRate(r) && r.eventId === event.id && r.market === drawMarket)}
          onToggle={() => toggle(draw)}
        />
      ) : null}
      <PxButton
        event={event}
        group={group}
        outcome={away}
        label={awayLabel}
        bettingOpen={bettingOpen}
        isRateAdded={rates.some((r) => isWcOddsRate(r) && r.eventId === event.id && r.market === awayMarket)}
        onToggle={() => toggle(away)}
      />
    </>
  );
}
