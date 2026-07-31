"use client";

import { useLocale } from "~/shared/model/useLocale";

import styles from "./ai-usage-policy.module.css";

export function AiUsagePolicyClient() {
  const { t } = useLocale();

  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <h1 className={styles.title}>{t("info.aiH1")}</h1>
        <p className={styles.meta}>{t("info.aiEffective")}</p>

        <h2 className={styles.h2}>{t("info.aiH1Agents")}</h2>
        <p dangerouslySetInnerHTML={{ __html: t("info.aiP1") }} />

        <h2 className={styles.h2}>{t("info.aiH2Design")}</h2>
        <p>{t("info.aiP2")}</p>

        <h2 className={styles.h2}>{t("info.aiH3Sanctions")}</h2>
        <p>{t("info.aiP3")}</p>

        <h2 className={styles.h2}>{t("info.aiH4En")}</h2>
        <p dangerouslySetInnerHTML={{ __html: t("info.aiP4En") }} />

        <h2 className={styles.h2}>{t("info.aiH5Contacts")}</h2>
        <p>
          Security:{" "}
          <a href="mailto:security@imbalance.click">security@imbalance.click</a>
          <br />
          Business:{" "}
          <a href="mailto:business@imbalance.click">business@imbalance.click</a>
        </p>
      </article>
    </main>
  );
}
