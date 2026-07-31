"use client";

import Link from "next/link";

import { CloudIcon, LogoIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./ShortNav.module.css";

const ShortNav = () => {
  const { t } = useLocale();

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <Link className={styles.logo} href="/">
          <LogoIcon />
        </Link>
        <div className={styles.content__right}>
          <div className={styles.support}>
            <div className={styles.support__text}>
              <div className={styles.support__title}>{t("support.247")}</div>
              <div className={styles.support__desc}>{t("info.askQuestion")}</div>
            </div>
            <Button className={styles.support__button} type="button">
              <CloudIcon className={styles.cloud} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortNav;
