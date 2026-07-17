import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type LeagueSectionProps = {
  title: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function LeagueSection({ title, trailing, children, className }: LeagueSectionProps) {
  return (
    <section className={cn(styles.leagueSection, className)}>
      <header className={styles.leagueHead}>
        <span>{title}</span>
        {trailing}
      </header>
      <div className={styles.leagueBody}>{children}</div>
    </section>
  );
}
