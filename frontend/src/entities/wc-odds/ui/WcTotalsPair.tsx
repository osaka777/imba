"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { formatTotalsScopeLabel, isScopeCaptionRedundant, type TotalsScopeOptions } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { usePrevious } from "~/shared/model";

import styles from "~/entities/game/ui/Match/Match.module.css";

type WcTotalsPairProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  under?: WcMarketOutcome;
  over?: WcMarketOutcome;
  point: number | string;
  bettingOpen: boolean;
  categoryName?: string;
  showScopeHeader?: boolean;
  scopeOptions?: TotalsScopeOptions;
  kickChip?: boolean;
};

export function WcTotalsPair({
  event,
  group,
  under,
  over,
  point,
  bettingOpen,
  categoryName,
  showScopeHeader = false,
  scopeOptions,
  kickChip = false,
}: WcTotalsPairProps) {
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const underValue = under ? under.price.toFixed(2) : "0";
  const overValue = over ? over.price.toFixed(2) : "0";
  const { prevState: prevUnder } = usePrevious(underValue);
  const { prevState: prevOver } = usePrevious(overValue);
  const underFlash = wcOddsFlashClasses(underValue, prevUnder, styles);
  const overFlash = wcOddsFlashClasses(overValue, prevOver, styles);

  const scopeLabel = showScopeHeader
    ? formatTotalsScopeLabel(group, categoryName, scopeOptions)
    : null;

  return (
    <div className={scopeLabel ? styles.totalsScopedRow : undefined}>
      {scopeLabel ? <p className={styles.totalsScopeCaption}>{scopeLabel}</p> : null}
      <MarketPairRow
        chipStyle={kickChip ? "kick" : "classic"}
        handicapLayout={!kickChip}
        totalsLayout={kickChip}
        pivot={point}
        showPivot={point !== ""}
        left={
          under
            ? {
                label: "М",
                value: underValue,
                selected: isSelected(under),
                bettable: isBettable(under),
                flashCell: underFlash.cell,
                flashCoef: underFlash.coef,
                onClick: () => toggle(under),
              }
            : undefined
        }
        right={
          over
            ? {
                label: "Б",
                value: overValue,
                selected: isSelected(over),
                bettable: isBettable(over),
                flashCell: overFlash.cell,
                flashCoef: overFlash.coef,
                onClick: () => toggle(over),
              }
            : undefined
        }
      />
    </div>
  );
}
