"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";
import { handicapRowSideLabel } from "~/entities/wc-odds/lib/wcHandicapPairs";
import { formatHandicapScopeLabel, isScopeCaptionRedundant } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { localizeWcLabel } from "~/entities/wc-odds/lib/localizeWcLabel";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { usePrevious } from "~/shared/model";
import { useLocale } from "~/shared/model/useLocale";

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
  kickChip?: boolean;
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
  kickChip = false,
}: WcHandicapPairProps) {
  const { t } = useLocale();
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const homeValue = home ? home.price.toFixed(2) : "0";
  const awayValue = away ? away.price.toFixed(2) : "0";
  const { prevState: prevHome } = usePrevious(homeValue);
  const { prevState: prevAway } = usePrevious(awayValue);
  const homeFlash = wcOddsFlashClasses(homeValue, prevHome, styles);
  const awayFlash = wcOddsFlashClasses(awayValue, prevAway, styles);

  const scopeOptions = {
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    sport: event.sport,
  };

  const scopeLabelRaw = showScopeHeader
    ? formatHandicapScopeLabel(group, categoryName, scopeOptions)
    : null;
  const scopeLabel = scopeLabelRaw ? localizeWcLabel(scopeLabelRaw, t) : null;
  const showScopeCaption = scopeLabel && !isScopeCaptionRedundant(categoryName, scopeLabelRaw);

  const labelOptions = { kickChip, pivot: point };
  const awayLabel = away
    ? handicapRowSideLabel(away, event.awayTeam, { ...labelOptions, side: "away" })
    : undefined;
  const homeLabel = home
    ? handicapRowSideLabel(home, event.homeTeam, { ...labelOptions, side: "home" })
    : undefined;

  return (
    <div className={showScopeCaption ? styles.totalsScopedRow : undefined}>
      {showScopeCaption ? <p className={styles.totalsScopeCaption}>{scopeLabel}</p> : null}
      <MarketPairRow
        chipStyle={kickChip ? "kick" : "classic"}
        handicapLayout={!kickChip}
        totalsLayout={kickChip}
        pivot={point}
        showPivot={point !== ""}
        left={
          away
            ? {
                label: awayLabel!,
                value: awayValue,
                selected: isSelected(away),
                bettable: isBettable(away),
                flashCell: awayFlash.cell,
                flashCoef: awayFlash.coef,
                onClick: () => toggle(away),
              }
            : undefined
        }
        right={
          home
            ? {
                label: homeLabel!,
                value: homeValue,
                selected: isSelected(home),
                bettable: isBettable(home),
                flashCell: homeFlash.cell,
                flashCoef: homeFlash.coef,
                onClick: () => toggle(home),
              }
            : undefined
        }
      />
    </div>
  );
}
