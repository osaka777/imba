"use client";

import { useEffect, useState } from "react";
import { getSubStats, SubIdStatRow } from "@/entities/user/api/getSubStats";
import { formatCurrencySymbol, formatMoney } from "@/shared/lib/formatCurrencySymbol";
import styles from "./SubIdAnalytics.module.css";

const DIMENSIONS = [
  { id: "sub1" as const, label: "sub1 — канал" },
  { id: "sub2" as const, label: "sub2 — кампания" },
  { id: "sub3" as const, label: "sub3 — креатив" },
  { id: "sub4" as const, label: "sub4 — гео" },
  { id: "sub5" as const, label: "sub5 — прочее" },
] as const;

type DimensionId = (typeof DIMENSIONS)[number]["id"];

const CURRENCIES = ["KZT", "USD", "RUB"] as const;

type Props = {
  initialDimension?: DimensionId;
};

export function SubIdAnalytics({ initialDimension = "sub1" }: Props) {
  const [dimension, setDimension] = useState<DimensionId>(initialDimension);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const [rows, setRows] = useState<SubIdStatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDimension(initialDimension);
  }, [initialDimension]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await getSubStats(dimension, currency);
      if (!cancelled) {
        setRows(data?.rows ?? []);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dimension, currency]);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Аналитика по SubID</h2>
          <p className={styles.desc}>
            Разбивка регистраций, FTD и комиссии по меткам в ссылке
          </p>
        </div>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={dimension}
            onChange={(e) => setDimension(e.target.value as DimensionId)}
          >
            {DIMENSIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {formatCurrencySymbol(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>
          Нет данных. Добавьте sub-параметры в реферальную ссылку на странице «Рефералы».
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Метка</th>
                <th>Регистрации</th>
                <th>FTD</th>
                <th>Конверсия</th>
                <th>Комиссия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.value}>
                  <td className={styles.label}>{row.value}</td>
                  <td>{row.registrations}</td>
                  <td>{row.ftd}</td>
                  <td>{row.conversionPct}%</td>
                  <td>
                    {formatMoney(row.commission, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
