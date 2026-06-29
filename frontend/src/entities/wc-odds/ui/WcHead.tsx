import React from "react";

import styles from "~/entities/wc-odds/ui/WcHead.module.css";

type WcHeadProps = {
  Icon: React.ComponentType<{ className?: string }>;
  name: string;
  totalLine?: number | null;
};

export function WcHead({ Icon, name, totalLine }: WcHeadProps) {
  const lineLabel = totalLine != null ? String(totalLine) : "Т";

  return (
    <div className={styles.Head}>
      <div className={styles.nameCell}>
        {Icon && <Icon className={styles.sportIcon} />}
        <p className={styles.name}>{name}</p>
      </div>
      <div className={styles.headRow}>
        {["1", "X", "2", lineLabel, "М", "Б"].map((field) => (
          <div
            className={`${styles.oddCell} ${field === lineLabel && totalLine != null ? styles.oddCell_special : ""}`}
            key={field}
          >
            {field}
          </div>
        ))}
      </div>
    </div>
  );
}
