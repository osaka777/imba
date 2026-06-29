"use client";

import { CSIcon, CloudIcon } from "~/shared/assets";
import { visibleGamesList } from "~/entities/game";
import { cn } from "~/shared/lib";

import type { TopEventsSportFilter } from "~/entities/wc-odds/ui/topEventsUtils";

import styles from "~/entities/wc-odds/ui/WcTopEventsSportFilter.module.css";

type WcTopEventsSportFilterProps = {
  sport: TopEventsSportFilter;
  onChange: (sport: TopEventsSportFilter) => void;
};

function FilterButton({
  active,
  label,
  onClick,
  Icon,
  showNewBadge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  Icon: React.FC<{ className?: string }>;
  showNewBadge?: boolean;
}) {
  return (
    <button
      className={cn(styles.item, active ? styles.item_active : styles.item_idle)}
      onClick={onClick}
      title={label}
      type="button"
    >
      {showNewBadge && (
        <span aria-hidden className={styles.newBadge}>
          NEW
        </span>
      )}
      <Icon className={styles.icon} />
      {active && <span className={styles.label}>{label}</span>}
    </button>
  );
}

export function WcTopEventsSportFilter({ sport, onChange }: WcTopEventsSportFilterProps) {
  const sports = visibleGamesList();

  return (
    <div className={styles.filter}>
      <div className={styles.track}>
        <FilterButton
          active={sport === "all"}
          Icon={CloudIcon}
          label="Все"
          onClick={() => onChange("all")}
        />
        {sports.map((item) => (
          <FilterButton
            active={sport === item.name}
            Icon={item.Icon}
            key={item.name}
            label={item.label}
            onClick={() => onChange(item.name)}
          />
        ))}
        <FilterButton
          active={sport === "cybersport"}
          Icon={CSIcon}
          label="Киберспорт"
          onClick={() => onChange("cybersport")}
          showNewBadge
        />
      </div>
    </div>
  );
}
