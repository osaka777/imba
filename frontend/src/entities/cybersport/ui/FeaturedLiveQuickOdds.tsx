"use client";

import { useMemo } from "react";

import type { CyberGame } from "~/entities/cybersport/api/client";
import { cyberGameSupportsWcBetting, cyberGameToWcEvent } from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { formatWcCompactOdd } from "~/entities/wc-odds/lib/wcCompactFormat";
import { WcHomeOddCell } from "~/entities/wc-odds/ui/WcHomeOddCell";

import styles from "./CybersportFeaturedLive.module.css";

type FeaturedLiveQuickOddsProps = {
  game: CyberGame;
};

export function FeaturedLiveQuickOdds({ game }: FeaturedLiveQuickOddsProps) {
  const wcEvent = useMemo(
    () => (cyberGameSupportsWcBetting(game) ? cyberGameToWcEvent(game) : null),
    [game],
  );

  if (!wcEvent) return null;

  const homeOdd = formatWcCompactOdd(wcEvent.oddsHome, "--");
  const awayOdd = formatWcCompactOdd(wcEvent.oddsAway, "--");
  const hasOdds = homeOdd !== "--" || awayOdd !== "--";

  if (!hasOdds) return null;

  return (
    <div
      className={styles.quickOdds}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className={styles.quickOddSlot}>
        <WcHomeOddCell event={wcEvent} pick="HOME" tone="kick" value={homeOdd} />
      </div>
      <div className={styles.quickOddSlot}>
        <WcHomeOddCell event={wcEvent} pick="AWAY" tone="kick" value={awayOdd} />
      </div>
    </div>
  );
}
