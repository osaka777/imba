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
  handicapLayout?: boolean;
};

export function MarketPairButton({
  side,
  labelAlign,
  totalsLayout = false,
  handicapLayout = false,
}: {
  side: MarketPairSide;
  labelAlign: "start" | "end";
  totalsLayout?: boolean;
  handicapLayout?: boolean;
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

  const useTotalsStyle = totalsLayout || handicapLayout;

  return (
    <div className={cn(styles.oddsItem, showLock && styles.oddsItem_lock)}>
      <Button
        className={cn(
          styles.odd,
          useTotalsStyle && styles.oddTotals,
          handicapLayout && styles.oddHandicap,
          side.selected && styles.odd_added,
        )}
        disabled={!side.bettable}
        onClick={() => side.bettable && side.onClick()}
      >
        {handicapLayout ? (
          coefNode
        ) : totalsLayout ? (
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
  handicapLayout = false,
}: MarketPairRowProps) {
  return (
    <div
      className={cn(
        styles.oddsBlock,
        styles.oddsBlockPair,
        showPivot && styles.oddsBlockPairOU,
        totalsLayout && styles.oddsTotalsRow,
        handicapLayout && styles.oddsHandicapRow,
      )}
    >
      {left ? (
        <MarketPairButton
          handicapLayout={handicapLayout}
          labelAlign="start"
          side={left}
          totalsLayout={totalsLayout}
        />
      ) : null}
      {showPivot && handicapLayout ? (
        <div className={styles.handicapPivotWrap}>
          {left?.label ? (
            <span className={styles.handicapPivotLabelLeft}>{left.label}</span>
          ) : null}
          <div className={styles.totalsPivot}>{pivot}</div>
          {right?.label ? (
            <span className={styles.handicapPivotLabelRight}>{right.label}</span>
          ) : null}
        </div>
      ) : showPivot ? (
        <div className={styles.totalsPivot}>{pivot}</div>
      ) : null}
      {right ? (
        <MarketPairButton
          handicapLayout={handicapLayout}
          labelAlign="end"
          side={right}
          totalsLayout={totalsLayout}
        />
      ) : null}
    </div>
  );
}
