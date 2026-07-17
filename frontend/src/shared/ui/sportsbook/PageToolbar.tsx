import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type PageToolbarProps = {
  title?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageToolbar({ title, meta, children, className }: PageToolbarProps) {
  return (
    <div className={cn(styles.pageToolbar, className)}>
      <div>
        {title ? <h2 className={styles.pageToolbarTitle}>{title}</h2> : null}
        {meta ? <div className={styles.pageToolbarMeta}>{meta}</div> : null}
      </div>
      {children}
    </div>
  );
}
