"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";
import { handicapOutcomeLabel } from "~/entities/wc-odds/lib/wcHandicapPairs";
import { formatHandicapScopeLabel, isScopeCaptionRedundant } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
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
      <MarketPairRow
        showPivot={false}
        totalsLayout
        pivot=""
        rowClassName={styles.oddsHandicapRow}
        left={
          home
            ? {
                label: handicapOutcomeLabel(home),
                value: homeValue,
                selected: isSelected(home),
                bettable: isBettable(home),
                flashCell: homeFlash.cell,
                flashCoef: homeFlash.coef,
                onClick: () => toggle(home),
              }
            : undefined
        }
        right={
          away
            ? {
                label: handicapOutcomeLabel(away),
                value: awayValue,
                selected: isSelected(away),
                bettable: isBettable(away),
                flashCell: awayFlash.cell,
                flashCoef: awayFlash.coef,
                onClick: () => toggle(away),
              }
            : undefined
        }
      />
    </div>
  );
}
