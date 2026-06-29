"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairButton } from "~/entities/markets/ui/MarketPairRow";
import {
  handicapDrawLabel,
  handicapPivotLabel,
  handicapSideLabel,
} from "~/entities/wc-odds/lib/wcHandicapPairs";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { usePrevious } from "~/shared/model";
import { cn } from "~/shared/lib";

import styles from "~/entities/game/ui/Match/Match.module.css";

type WcHandicap3WayPivotRowProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  home: WcMarketOutcome;
  draw: WcMarketOutcome;
  away: WcMarketOutcome;
  bettingOpen: boolean;
};

export function WcHandicap3WayPivotRow({
  event,
  group,
  home,
  draw,
  away,
  bettingOpen,
}: WcHandicap3WayPivotRowProps) {
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const homeValue = home.price.toFixed(2);
  const drawValue = draw.price.toFixed(2);
  const awayValue = away.price.toFixed(2);

  const { prevState: prevHome } = usePrevious(homeValue);
  const { prevState: prevDraw } = usePrevious(drawValue);
  const { prevState: prevAway } = usePrevious(awayValue);

  const homeFlash = wcOddsFlashClasses(homeValue, prevHome, styles);
  const drawFlash = wcOddsFlashClasses(drawValue, prevDraw, styles);
  const awayFlash = wcOddsFlashClasses(awayValue, prevAway, styles);

  const pivot = handicapPivotLabel(home, away);

  return (
    <div
      className={cn(
        styles.oddsBlock,
        styles.oddsBlockPair,
        styles.oddsBlockPairOU,
        styles.oddsTotalsRow,
        styles.oddsHandicap3Row,
      )}
    >
      <MarketPairButton
        side={{
          label: handicapSideLabel(home),
          value: homeValue,
          selected: isSelected(home),
          bettable: isBettable(home),
          flashCell: homeFlash.cell,
          flashCoef: homeFlash.coef,
          onClick: () => toggle(home),
        }}
        labelAlign="start"
      />
      {pivot ? <div className={styles.totalsPivot}>{pivot}</div> : null}
      <MarketPairButton
        side={{
          label: handicapDrawLabel(),
          value: drawValue,
          selected: isSelected(draw),
          bettable: isBettable(draw),
          flashCell: drawFlash.cell,
          flashCoef: drawFlash.coef,
          onClick: () => toggle(draw),
        }}
        labelAlign="end"
      />
      <MarketPairButton
        side={{
          label: handicapSideLabel(away),
          value: awayValue,
          selected: isSelected(away),
          bettable: isBettable(away),
          flashCell: awayFlash.cell,
          flashCoef: awayFlash.coef,
          onClick: () => toggle(away),
        }}
        labelAlign="end"
      />
    </div>
  );
}
