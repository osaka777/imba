"use client";

import { useEffect, useState } from "react";

import { fetchSupportAppeals, type SupportAppeal } from "~/entities/support/api/client";
import { tagLabel } from "~/entities/support/lib/supportExtras";

import styles from "./page.module.css";

function formatDate(at?: number) {
  if (!at) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}

export default function SupportAppealsPage() {
  const [appeals, setAppeals] = useState<SupportAppeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupportAppeals()
      .then(setAppeals)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Мои обращения</h1>
      <p className={styles.subtitle}>История чатов с поддержкой imba.bet</p>

      {loading ? <p className={styles.empty}>Загрузка…</p> : null}
      {!loading && appeals.length === 0 ? (
        <p className={styles.empty}>Обращений пока нет. Откройте чат 24/7 в правом нижнем углу.</p>
      ) : null}

      <ul className={styles.list}>
        {appeals.map((item) => (
          <li key={item.sessionId} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={styles.tag}>{tagLabel(item.tag)}</span>
              <span className={styles.date}>{formatDate(item.updatedAt)}</span>
            </div>
            <p className={styles.preview}>{item.preview || "Без текста"}</p>
            <div className={styles.itemFoot}>
              <span className={item.closed ? styles.statusClosed : styles.statusOpen}>
                {item.closed ? "Закрыто" : "Открыто"}
              </span>
              {item.csat ? <span className={styles.csat}>Оценка: {item.csat}/5</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
