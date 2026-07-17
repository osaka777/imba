"use client";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { MarketPairRow } from "~/entities/markets/ui/MarketPairRow";
import { wcOddsFlashClasses } from "~/entities/wc-odds/lib/wcCoefFlash";
import { useWcMarketPairToggle } from "~/entities/wc-odds/lib/useWcMarketPairToggle";
import { usePrevious } from "~/shared/model";

import styles from "~/entities/game/ui/Match/Match.module.css";

type WcEvenOddPairProps = {
  event: WcEventDetail;
  group: WcMarketGroup;
  even?: WcMarketOutcome;
  odd?: WcMarketOutcome;
  bettingOpen: boolean;
  kickChip?: boolean;
};

export function WcEvenOddPair({ event, group, even, odd, bettingOpen, kickChip = false }: WcEvenOddPairProps) {
  const { toggle, isSelected, isBettable } = useWcMarketPairToggle(event, group, bettingOpen);

  const evenValue = even ? even.price.toFixed(2) : "0";
  const oddValue = odd ? odd.price.toFixed(2) : "0";
  const { prevState: prevEven } = usePrevious(evenValue);
  const { prevState: prevOdd } = usePrevious(oddValue);
  const evenFlash = wcOddsFlashClasses(evenValue, prevEven, styles);
  const oddFlash = wcOddsFlashClasses(oddValue, prevOdd, styles);

  return (
    <MarketPairRow
      chipStyle={kickChip ? "kick" : "classic"}
      handicapLayout={!kickChip}
      totalsLayout={kickChip}
      pivot=""
      showPivot={false}
      left={
        even
          ? {
              label: "Ч",
              value: evenValue,
              selected: isSelected(even),
              bettable: isBettable(even),
              flashCell: evenFlash.cell,
              flashCoef: evenFlash.coef,
              onClick: () => toggle(even),
            }
          : undefined
      }
      right={
        odd
          ? {
              label: "Н",
              value: oddValue,
              selected: isSelected(odd),
              bettable: isBettable(odd),
              flashCell: oddFlash.cell,
              flashCoef: oddFlash.coef,
              onClick: () => toggle(odd),
            }
          : undefined
      }
    />
  );
}
