"use client";

import { useLocale } from "~/shared/model/useLocale";

import styles from "./forms/NirvanaPayForm.module.css";

type DepositFormHeadingProps = {
  subtitle?: string;
  title?: string;
};

export const DepositFormHeading = ({
  title,
  subtitle,
}: DepositFormHeadingProps) => {
  const { t } = useLocale();
  const resolvedTitle = title ?? t("deposit.heading");

  if (!subtitle) {
    return <h2 className={styles.heading}>{resolvedTitle}</h2>;
  }

  return (
    <div className={styles.headingGroup}>
      <h2 className={styles.heading}>{resolvedTitle}</h2>
      <p className={styles.headingSubline}>{subtitle}</p>
    </div>
  );
};
