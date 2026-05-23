import Link from "next/link";

import { CloudIcon, LogoIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";

import styles from "./ShortNav.module.css";

const ShortNav = () => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <Link className={styles.logo} href="/">
          <LogoIcon />
        </Link>
        <div className={styles.content__right}>
          <div className={styles.support}>
            <div className={styles.support__text}>
              <div className={styles.support__title}>Поддержка 24/7</div>
              <div className={styles.support__desc}>Задать вопрос</div>
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
