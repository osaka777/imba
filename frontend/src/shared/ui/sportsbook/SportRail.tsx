import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type SportRailProps = {
  children: ReactNode;
  vertical?: boolean;
  className?: string;
};

export function SportRail({ children, vertical = false, className }: SportRailProps) {
  return (
    <div
      className={cn(
        styles.sportRail,
        vertical && styles.sportRailVertical,
        className,
      )}
    >
      {children}
    </div>
  );
}

type SportChipProps = {
  children: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: () => void;
};

export function SportChip({ children, active, className, onClick }: SportChipProps) {
  return (
    <button
      type="button"
      className={cn(styles.sportChip, active && styles.sportChipActive, className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
