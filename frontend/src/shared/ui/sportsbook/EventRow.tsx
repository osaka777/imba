import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type EventRowProps = {
  meta?: ReactNode;
  teams: ReactNode;
  score?: ReactNode;
  odds?: ReactNode;
  alt?: boolean;
  className?: string;
  onClick?: () => void;
};

export function EventRow({
  meta,
  teams,
  score,
  odds,
  alt,
  className,
  onClick,
}: EventRowProps) {
  return (
    <div
      className={cn(styles.eventRow, alt && styles.eventRowAlt, className)}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {meta ? <div className={styles.eventMeta}>{meta}</div> : null}
      <div className={styles.eventTeams}>{teams}</div>
      {score}
      {odds}
    </div>
  );
}
