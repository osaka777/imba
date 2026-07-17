"use client";

import { LuckyDriveBanner } from "~/entities/game/ui/LuckyDrive/LuckyDriveBanner";
import { WcHomeSection } from "~/entities/wc-odds/ui/WcHomeSection";

import styles from "./Home.module.css";

/** Без лишних dynamic() — один чанк, API матчей стартует сразу после гидратации. */
export function HomeDeferredSections() {
  return (
    <div className={styles.Home}>
      <LuckyDriveBanner placement="home" />
      <WcHomeSection />
    </div>
  );
}
