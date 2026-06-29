"use client";

import type { ReactNode } from "react";

import { convertToFixed } from "~/entities/game/lib";
import { AccessIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";

import styles from "~/entities/game/ui/Match/Match.module.css";

export type MarketPairSide = {
  label: string;
  value: string;
  selected: boolean;
  bettable: boolean;
  flashCell?: string;
  flashCoef?: string;
  onClick: () => void;
};

type MarketPairRowProps = {
  left?: MarketPairSide;
  right?: MarketPairSide;
  pivot: ReactNode;
  showPivot?: boolean;
  totalsLayout?: boolean;
};

export function MarketPairButton({
  side,
  labelAlign,
  totalsLayout = false,
}: {
  side: MarketPairSide;
  labelAlign: "start" | "end";
  totalsLayout?: boolean;
}) {
  const showLock = !side.bettable;
  const labelClass = cn(
    styles.pairSideLabel,
    labelAlign === "start" ? styles.pairSideLabel_start : styles.pairSideLabel_end,
  );

  const labelNode = <p className={labelClass}>{side.label}</p>;
  const coefNode = (
    <p className={cn(styles.oddCoef, side.flashCoef)}>
      {convertToFixed(side.value)}
      {showLock && <AccessIcon className={styles.lock} />}
    </p>
  );

  return (
    <div className={cn(styles.oddsItem, showLock && styles.oddsItem_lock)}>
      <Button
        className={cn(
          styles.odd,
          totalsLayout && styles.oddTotals,
          side.flashCell,
          side.selected && styles.odd_added,
        )}
        disabled={!side.bettable}
        onClick={() => side.bettable && side.onClick()}
      >
        {totalsLayout ? (
          <>
            {labelNode}
            {coefNode}
          </>
        ) : labelAlign === "start" ? (
          <>
            {coefNode}
            {labelNode}
          </>
        ) : (
          <>
            {labelNode}
            {coefNode}
          </>
        )}
      </Button>
    </div>
  );
}

export function MarketPairRow({
  left,
  right,
  pivot,
  showPivot = true,
  totalsLayout = false,
}: MarketPairRowProps) {
  return (
    <div
      className={cn(
        styles.oddsBlock,
        styles.oddsBlockPair,
        showPivot && styles.oddsBlockPairOU,
        totalsLayout && styles.oddsTotalsRow,
      )}
    >
      {left ? <MarketPairButton labelAlign="start" side={left} totalsLayout={totalsLayout} /> : null}
      {showPivot ? <div className={styles.totalsPivot}>{pivot}</div> : null}
      {right ? <MarketPairButton labelAlign="end" side={right} totalsLayout={totalsLayout} /> : null}
    </div>
  );
}
