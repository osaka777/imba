import React from "react";

import {
  sportHasDoubleChance,
  sportHasTotals,
  sportIsTwoWay,
} from "~/entities/wc-odds/lib/wcLiveScore";

import styles from "~/entities/wc-odds/ui/WcTournamentHead.module.css";

type WcTournamentHeadProps = {
  Icon: React.ComponentType<{ className?: string }>;
  name: string;
  sport: string;
};

function buildColumns(sport: string): Array<{ key: string; label: string; pivot?: boolean }> {
  const cols: Array<{ key: string; label: string; pivot?: boolean }> = [];

  if (sportIsTwoWay(sport)) {
    cols.push({ key: "1", label: "1" }, { key: "2", label: "2" });
  } else {
    cols.push({ key: "1", label: "1" }, { key: "X", label: "X" }, { key: "2", label: "2" });
    if (sportHasDoubleChance(sport)) {
      cols.push(
        { key: "1X", label: "1X" },
        { key: "12", label: "12" },
        { key: "X2", label: "X2" },
      );
    }
  }

  if (sportHasTotals(sport)) {
    cols.push(
      { key: "total", label: "Тотал", pivot: true },
      { key: "under", label: "ТМ" },
      { key: "over", label: "ТБ" },
    );
  }

  return cols;
}

export function WcTournamentHead({ Icon, name, sport }: WcTournamentHeadProps) {
  const columns = buildColumns(sport);

  return (
    <div className={styles.Head} data-cols={columns.length}>
      <div className={styles.nameCell}>
        {Icon && <Icon className={styles.sportIcon} />}
        <p className={styles.name}>{name}</p>
      </div>
      <div className={styles.headRow}>
        {columns.map((col) => (
          <div
            className={`${styles.oddCell} ${col.pivot ? styles.oddCell_pivot : ""}`}
            key={col.key}
          >
            {col.label}
          </div>
        ))}
      </div>
    </div>
  );
}
