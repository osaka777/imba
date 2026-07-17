import styles from "./CybersportMatchSkeleton.module.css";

type CybersportMatchSkeletonProps = {
  rows?: number;
};

export function CybersportMatchSkeleton({ rows = 4 }: CybersportMatchSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Загрузка матчей" className={styles.wrap}>
      <div className={styles.head} />
      {Array.from({ length: rows }, (_, i) => (
        <div className={styles.row} key={i}>
          <div className={styles.teamBlock}>
            <div className={styles.logo} />
            <div className={styles.name} />
          </div>
          <div className={styles.score} />
          <div className={styles.teamBlock}>
            <div className={styles.logo} />
            <div className={styles.name} />
          </div>
          <div className={styles.odds}>
            <div className={styles.odd} />
            <div className={styles.odd} />
          </div>
        </div>
      ))}
    </div>
  );
}
