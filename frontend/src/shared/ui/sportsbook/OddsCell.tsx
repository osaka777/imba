import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type OddsCellProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  children: ReactNode;
};

export function OddsCell({ selected, children, className, ...props }: OddsCellProps) {
  return (
    <button
      type="button"
      className={cn(styles.oddsCell, selected && styles.oddsCellSelected, className)}
      {...props}
    >
      {children}
    </button>
  );
}

type OddsGridProps = {
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
};

export function OddsGrid({ children, columns = 3, className }: OddsGridProps) {
  return (
    <div
      className={cn(
        styles.oddsGrid,
        columns === 2 && styles.oddsGridTwo,
        className,
      )}
    >
      {children}
    </div>
  );
}
