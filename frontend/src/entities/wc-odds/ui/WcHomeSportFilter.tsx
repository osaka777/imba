"use client";

import { getHomeSports } from "~/entities/wc-odds/ui/homeSectionUtils";
import { cn } from "~/shared/lib";

import styles from "~/entities/wc-odds/ui/WcHomeSportFilter.module.css";
import type { HomeSportFilterItem } from "~/entities/wc-odds/ui/homeSportFilters";

type WcHomeSportFilterProps = {
  variant: "live" | "prematch";
  sport?: string;
  onChange: (sport: string) => void;
};

function SportIconButton({
  item,
  active,
  onClick,
}: {
  item: HomeSportFilterItem;
  active: boolean;
  onClick: () => void;
}) {
  const { Icon, label } = item;

  return (
    <button
      className={cn(styles.item, active ? styles.item_pill : styles.item_circle)}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className={styles.icon} />
      {active && <span className={styles.label}>{label}</span>}
    </button>
  );
}

export function WcHomeSportFilter({
  variant,
  sport,
  onChange,
}: WcHomeSportFilterProps) {
  const sports = getHomeSports(variant);
  const activeSport = sport ?? sports[0]?.name ?? "soccer";

  return (
    <div className={styles.filter}>
      <div className={styles.track}>
        {sports.map((item) => (
          <SportIconButton
            active={activeSport === item.name}
            item={item}
            key={item.name}
            onClick={() => onChange(item.name)}
          />
        ))}
      </div>
    </div>
  );
}
