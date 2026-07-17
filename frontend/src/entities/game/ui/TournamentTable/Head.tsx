import React from "react";

import { isEsportsApiSport } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import styles from "./Head.module.css";

type HeadProps = {
  Icon: any;
  name: string;
  sport: string;
};

const createHeadFieldsRow = (fields: string[]) => (
  <div className={styles.headRow}>
    {fields.map((field) => (
      <div className={styles.oddCell} key={field}>
        {field}
      </div>
    ))}
  </div>
);

// Заголовки таблицы с английскими сокращениями для единообразия интерфейса
const headSportRows: { [key: string]: React.ReactElement } = {
  basketball: createHeadFieldsRow([`1`, `X`, `2`]),
  "cyber-basketball": createHeadFieldsRow([`1`, `X`, `2`]),
  "cyber-football": createHeadFieldsRow([`1`, `X`, `2`, `1X`, `12`, `X2`]),
  hockey: createHeadFieldsRow([`1`, `X`, `2`]),
  soccer: createHeadFieldsRow([
    `1`,
    `X`,
    `2`,
    `1X`,
    `12`,
    `X2`,
  ]),
  "table-tennis": createHeadFieldsRow([`1`, `2`]),
  tennis: createHeadFieldsRow([`1`, `2`]),
  volleyball: createHeadFieldsRow([`1`, `2`]),
};

export const Head: React.FC<HeadProps> = ({ Icon, name, sport }) => {
  return (
    <div className={styles.Head}>
      <div className={styles.nameCell}>
        {Icon && <Icon className={styles.sportIcon} />}
        <p className={styles.name}>{name}</p>
      </div>
      {headSportRows[sport] ?? (isEsportsApiSport(sport) ? createHeadFieldsRow([`1`, `2`]) : null)}
    </div>
  );
};
