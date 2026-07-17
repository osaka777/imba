"use client";

import type { ReactNode } from "react";

import { convertToFixed } from "~/entities/game/lib";
import { AccessIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";

import styles from "~/entities/game/ui/Match/Match.module.css";

export type MarketPairChipStyle = "classic" | "kick";

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
  widePivot?: boolean;
  /** Kick/cyber flat chip (label + coef inside one button). Default: classic sportsbook. */
  chipStyle?: MarketPairChipStyle;
};

export function MarketPairButton({
  side,
  labelAlign,
  totalsLayout = false,
  handicapLayout = false,
  chipStyle = "classic",
}: {
  side: MarketPairSide;
  labelAlign: "start" | "end";
  totalsLayout?: boolean;
  handicapLayout?: boolean;
  chipStyle?: MarketPairChipStyle;
}) {
  const showLock = !side.bettable;
  const useKickChip = chipStyle === "kick" && (totalsLayout || handicapLayout);

  const labelNode = useKickChip ? (
    <p className={styles.oddName}>{side.label}</p>
  ) : (
    <p
      className={cn(
        styles.pairSideLabel,
        labelAlign === "start" ? styles.pairSideLabel_start : styles.pairSideLabel_end,
      )}
    >
      {side.label}
    </p>
  );

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
          handicapLayout && !useKickChip && styles.oddHandicap,
          side.selected && styles.odd_added,
        )}
        disabled={!side.bettable}
        onClick={() => side.bettable && side.onClick()}
      >
        {handicapLayout && !useKickChip ? (
          coefNode
        ) : useTotalsStyle ? (
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
  widePivot = false,
  chipStyle = "classic",
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
      data-chip-style={chipStyle === "kick" ? "kick" : undefined}
    >
      {left ? (
        <MarketPairButton
          chipStyle={chipStyle}
          handicapLayout={handicapLayout}
          labelAlign="start"
          side={left}
          totalsLayout={totalsLayout}
        />
      ) : null}
      {handicapLayout && chipStyle !== "kick" && (showPivot || left?.label || right?.label) ? (
        <div className={styles.handicapPivotWrap}>
          {left?.label ? (
            <span className={styles.handicapPivotLabelLeft}>{left.label}</span>
          ) : null}
          {showPivot ? (
            <div
              className={cn(styles.totalsPivot, widePivot && styles.totalsPivotWide)}
              title={typeof pivot === "string" ? pivot : undefined}
            >
              {pivot}
            </div>
          ) : null}
          {right?.label ? (
            <span className={styles.handicapPivotLabelRight}>{right.label}</span>
          ) : null}
        </div>
      ) : showPivot ? (
        <div
          className={cn(styles.totalsPivot, widePivot && styles.totalsPivotWide)}
          title={typeof pivot === "string" ? pivot : undefined}
        >
          {pivot}
        </div>
      ) : null}
      {right ? (
        <MarketPairButton
          chipStyle={chipStyle}
          handicapLayout={handicapLayout}
          labelAlign="end"
          side={right}
          totalsLayout={totalsLayout}
        />
      ) : null}
    </div>
  );
}
