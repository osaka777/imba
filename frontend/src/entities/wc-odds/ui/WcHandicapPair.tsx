"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairButton } from "~/entities/markets/ui/MarketPairRow";
import { handicapSideLabel } from "~/entities/wc-odds/lib/wcHandicapPairs";
import { formatHandicapScopeLabel, isScopeCaptionRedundant } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { cn } from "~/shared/lib";
import { usePrevious } from "~/shared/model";

import styles from "~/entities/game/ui/Match/Match.module.css";

type WcHandicapPairProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  home?: WcMarketOutcome;
  away?: WcMarketOutcome;
  point: number | string;
  bettingOpen: boolean;
  categoryName?: string;
  showScopeHeader?: boolean;
};

export function WcHandicapPair({
  event,
  group,
  home,
  away,
  point,
  bettingOpen,
  categoryName,
  showScopeHeader = false,
}: WcHandicapPairProps) {
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const homeValue = home ? home.price.toFixed(2) : "0";
  const awayValue = away ? away.price.toFixed(2) : "0";
  const { prevState: prevHome } = usePrevious(homeValue);
  const { prevState: prevAway } = usePrevious(awayValue);
  const homeFlash = wcOddsFlashClasses(homeValue, prevHome, styles);
  const awayFlash = wcOddsFlashClasses(awayValue, prevAway, styles);

  const scopeLabel = showScopeHeader
    ? formatHandicapScopeLabel(group, categoryName)
    : null;
  const showScopeCaption = scopeLabel && !isScopeCaptionRedundant(categoryName, scopeLabel);

  return (
    <div className={showScopeCaption ? styles.totalsScopedRow : undefined}>
      {showScopeCaption ? <p className={styles.totalsScopeCaption}>{scopeLabel}</p> : null}
      <div
        className={cn(
          styles.oddsBlock,
          styles.oddsBlockPair,
          styles.oddsBlockPairOU,
          styles.oddsHandicapPair,
        )}
      >
        {away ? (
          <MarketPairButton
            labelAlign="end"
            side={{
              label: handicapSideLabel(away),
              value: awayValue,
              selected: isSelected(away),
              bettable: isBettable(away),
              flashCell: awayFlash.cell,
              flashCoef: awayFlash.coef,
              onClick: () => toggle(away),
            }}
          />
        ) : null}

        {point !== "" ? <div className={styles.totalsPivot}>{point}</div> : null}

        {home ? (
          <MarketPairButton
            labelAlign="end"
            side={{
              label: handicapSideLabel(home),
              value: homeValue,
              selected: isSelected(home),
              bettable: isBettable(home),
              flashCell: homeFlash.cell,
              flashCoef: homeFlash.coef,
              onClick: () => toggle(home),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
