"use client";

import { LuckyDriveBanner } from "~/entities/game/ui/LuckyDrive/LuckyDriveBanner";
import { WcHomeSection } from "~/entities/wc-odds/ui/WcHomeSection";

import styles from "./Home.module.css";

/** Lucky Drive → live/line. Cyber live strip is not shown on home. */
export function HomeDeferredSections() {
  return (
    <div className={styles.Home}>
      <LuckyDriveBanner placement="home" />
      <WcHomeSection />
    </div>
  );
}
