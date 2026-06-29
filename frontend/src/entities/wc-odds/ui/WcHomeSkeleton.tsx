import { getHomeTableColumnsForSport } from "~/entities/wc-odds/ui/homeSectionUtils";

import styles from "~/entities/wc-odds/ui/WcHomeSkeleton.module.css";

type WcHomeSkeletonProps = {
  rows?: number;
  isTwoWay?: boolean;
  sport?: string;
};

export function WcHomeSkeleton({ rows = 5, isTwoWay = false, sport = "soccer" }: WcHomeSkeletonProps) {
  const gridColumns = getHomeTableColumnsForSport(sport);

  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <div
          className={`${styles.skeletonRow} ${index % 2 === 1 ? styles.skeletonRow_alt : ""}`}
          key={index}
          style={{ gridTemplateColumns: gridColumns }}
        >
          <div className={styles.skeletonMain}>
            <div className={`${styles.block} ${styles.timeBlock}`} />
            <div className={styles.teamsWrap}>
              <div className={`${styles.block} ${styles.teamBlock} ${styles.teamBlock_long}`} />
              <div className={`${styles.block} ${styles.teamBlock} ${styles.teamBlock_short}`} />
            </div>
          </div>
          <div
            className={`${styles.skeletonOdds} ${isTwoWay ? styles.skeletonOdds_twoWay : ""}`}
          >
            <div className={`${styles.block} ${styles.oddBlock}`} />
            {!isTwoWay && <div className={`${styles.block} ${styles.oddBlock}`} />}
            <div className={`${styles.block} ${styles.oddBlock}`} />
          </div>
        </div>
      ))}
    </>
  );
}
