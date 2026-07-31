"use client";

import { useEffect, useState } from "react";

import { fetchSupportAppeals, type SupportAppeal } from "~/entities/support/api/client";
import { tagLabel } from "~/entities/support/lib/supportExtras";
import { toIntlLocale } from "~/shared/i18n/format";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./page.module.css";

export default function SupportAppealsPage() {
  const { t, locale } = useLocale();
  const [appeals, setAppeals] = useState<SupportAppeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupportAppeals()
      .then(setAppeals)
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (at?: number) => {
    if (!at) return "—";
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(at));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("support.appealsTitle")}</h1>
      <p className={styles.subtitle}>{t("support.appealsSubtitle")}</p>

      {loading ? <p className={styles.empty}>{t("support.appealsLoading")}</p> : null}
      {!loading && appeals.length === 0 ? (
        <p className={styles.empty}>{t("support.appealsEmpty")}</p>
      ) : null}

      <ul className={styles.list}>
        {appeals.map((item) => (
          <li key={item.sessionId} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={styles.tag}>{tagLabel(item.tag, t)}</span>
              <span className={styles.date}>{formatDate(item.updatedAt)}</span>
            </div>
            <p className={styles.preview}>{item.preview || t("support.appealsNoText")}</p>
            <div className={styles.itemFoot}>
              <span className={item.closed ? styles.statusClosed : styles.statusOpen}>
                {item.closed ? t("support.appealsClosed") : t("support.appealsOpen")}
              </span>
              {item.csat ? (
                <span className={styles.csat}>
                  {t("support.appealsRating", { n: item.csat })}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
