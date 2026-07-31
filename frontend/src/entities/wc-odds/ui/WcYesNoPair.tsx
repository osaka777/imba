"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { usePrevious } from "~/shared/model";
import { useLocale } from "~/shared/model/useLocale";

import styles from "~/entities/game/ui/Match/Match.module.css";
import { resolveYesNoPivotLine } from "~/entities/wc-odds/lib/wcYesNoLineTitle";

type WcYesNoPairProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  yes?: WcMarketOutcome;
  no?: WcMarketOutcome;
  bettingOpen: boolean;
  categoryName?: string;
  yesLabel?: string;
  noLabel?: string;
  pivotLabel?: string;
  kickChip?: boolean;
};

export function WcYesNoPair({
  event,
  group,
  yes,
  no,
  bettingOpen,
  categoryName = "",
  yesLabel: yesLabelProp,
  noLabel: noLabelProp,
  pivotLabel,
  kickChip = false,
}: WcYesNoPairProps) {
  const { t } = useLocale();
  const yesLabel = yesLabelProp ?? t("wc.yes");
  const noLabel = noLabelProp ?? t("wc.no");
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const yesValue = yes ? yes.price.toFixed(2) : "0";
  const noValue = no ? no.price.toFixed(2) : "0";
  const { prevState: prevYes } = usePrevious(yesValue);
  const { prevState: prevNo } = usePrevious(noValue);
  const yesFlash = wcOddsFlashClasses(yesValue, prevYes, styles);
  const noFlash = wcOddsFlashClasses(noValue, prevNo, styles);
  const { pivot, showPivot } = kickChip
    ? { pivot: "", showPivot: false }
    : pivotLabel
      ? { pivot: pivotLabel, showPivot: true }
      : resolveYesNoPivotLine(group, categoryName);

  const isShortResultPivot = Boolean(pivotLabel && /^(П1|П2|X|1X|12|X2)$/i.test(pivotLabel.trim()));
  const useTotalsPivotLayout = isShortResultPivot && !kickChip;
  const widePivot = false;

  return (
    <MarketPairRow
      chipStyle={kickChip ? "kick" : "classic"}
      handicapLayout={!kickChip && !useTotalsPivotLayout}
      totalsLayout={kickChip || useTotalsPivotLayout}
      widePivot={widePivot}
      pivot={pivot}
      showPivot={showPivot}
      left={
        yes
          ? {
              label: yesLabel,
              value: yesValue,
              selected: isSelected(yes),
              bettable: isBettable(yes),
              flashCell: yesFlash.cell,
              flashCoef: yesFlash.coef,
              onClick: () => toggle(yes),
            }
          : undefined
      }
      right={
        no
          ? {
              label: noLabel,
              value: noValue,
              selected: isSelected(no),
              bettable: isBettable(no),
              flashCell: noFlash.cell,
              flashCoef: noFlash.coef,
              onClick: () => toggle(no),
            }
          : undefined
      }
    />
  );
}
