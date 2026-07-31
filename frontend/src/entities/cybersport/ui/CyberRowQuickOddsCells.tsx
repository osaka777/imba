"use client";

import Link from "next/link";

import type { CyberRowQuickOdds } from "~/entities/cybersport/lib/extractCyberRowQuickOdds";
import type { WcEvent, WcEventDetail } from "~/entities/wc-odds/api/client";
import { formatWcCompactOdd } from "~/entities/wc-odds/lib/wcCompactFormat";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";
import { WcSingleBetRow } from "~/entities/wc-odds/ui/WcSingleBetRow";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CyberMatchRow.module.css";

type CyberRowQuickOddsCellsProps = {
  detail: WcEventDetail;
  quick: CyberRowQuickOdds;
};

function h2hEventFromDetail(
  detail: WcEventDetail,
  quick: Extract<CyberRowQuickOdds, { kind: "h2h" }>,
): WcEvent {
  return {
    ...detail,
    oddsHome: quick.home,
    oddsDraw: quick.draw,
    oddsAway: quick.away,
  };
}

export function CyberRowQuickOddsCells({ detail, quick }: CyberRowQuickOddsCellsProps) {
  const { t } = useLocale();
  const bettingOpen = useWcBettingOpen(detail);

  if (quick.kind === "h2h") {
    const h2hEvent = h2hEventFromDetail(detail, quick);
    const isTwoWay = quick.draw == null;

    return (
      <>
        <div className={styles.oddSlot}>
          <WcHomeOddCell
            event={h2hEvent}
            pick="HOME"
            value={formatWcCompactOdd(quick.home, "--")}
          />
        </div>
        {!isTwoWay && quick.draw != null ? (
          <div className={styles.oddSlot}>
            <WcHomeOddCell
              event={h2hEvent}
              pick="DRAW"
              value={formatWcCompactOdd(quick.draw, "--")}
            />
          </div>
        ) : null}
        <div className={styles.oddSlot}>
          <WcHomeOddCell
            event={h2hEvent}
            pick="AWAY"
            value={formatWcCompactOdd(quick.away, "--")}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.oddSlot}>
        <WcSingleBetRow
          bettingOpen={bettingOpen}
          event={detail}
          group={quick.group}
          is1X2
          outcome={quick.homeOutcome}
          title={t("cyber.quickP1", { n: quick.mapNum })}
        />
      </div>
      <div className={styles.oddSlot}>
        <WcSingleBetRow
          bettingOpen={bettingOpen}
          event={detail}
          group={quick.group}
          is1X2
          outcome={quick.awayOutcome}
          title={t("cyber.quickP2", { n: quick.mapNum })}
        />
      </div>
    </>
  );
}

type CyberRowMarketsLinkProps = {
  gameHref: string;
  marketsCount: number;
};

export function CyberRowMarketsLink({ gameHref, marketsCount }: CyberRowMarketsLinkProps) {
  const { t } = useLocale();
  if (marketsCount <= 0) return null;

  return (
    <Link
      className={styles.marketsLink}
      href={gameHref}
      onClick={(e) => e.stopPropagation()}
    >
      <span className={styles.marketsLinkLabel}>{t("cyber.markets")}</span>
      <span className={styles.marketsLinkCount}>{`+${marketsCount}`}</span>
    </Link>
  );
}
