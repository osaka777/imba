"use client";

import { CYBER_SPORTS, DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { cn } from "~/shared/lib";

import styles from "./CybersportSportFilter.module.css";

type CybersportSportFilterProps = {
  sport: string;
  onChange: (sport: string) => void;
};

function SportIconButton({
  item,
  active,
  onClick,
}: {
  item: (typeof CYBER_SPORTS)[number];
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

export function CybersportSportFilter({ sport, onChange }: CybersportSportFilterProps) {
  const activeSport = sport || DEFAULT_CYBER_SPORT;

  return (
    <div className={styles.filter}>
      <div className={styles.track}>
        {CYBER_SPORTS.map((item) => (
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
