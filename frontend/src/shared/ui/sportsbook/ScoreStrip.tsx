import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type ScoreStripProps = {
  main: ReactNode;
  sub?: ReactNode;
  className?: string;
};

export function ScoreStrip({ main, sub, className }: ScoreStripProps) {
  return (
    <div className={cn(styles.scoreStrip, className)}>
      <span>{main}</span>
      {sub ? <span className={styles.scoreStripMuted}>{sub}</span> : null}
    </div>
  );
}
