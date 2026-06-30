import React from "react";
import styles from "./contacts.module.css";
import { TelegramIcon } from "@/shared/assets";
import shell from "../profile-shell.module.css";

const Page = () => {
  return (
    <>
      <header className={shell.pageHeader}>
        <h1 className={shell.pageTitle}>Контакты</h1>
        <p className={shell.pageSubtitle}>
          Связь с менеджерами по RevShare и CPA
        </p>
      </header>
      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardBadge}>RevShare</div>
          <h2 className={styles.cardTitle}>RevShare</h2>
          <p className={styles.cardDesc}>
            Вопросы по проценту от проигрышей и выплатам
          </p>
          <a
            href="https://t.me/imbabetofficial"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cardContact}
          >
            <TelegramIcon />
            @imbabetofficial
          </a>
        </div>
        <div className={styles.card}>
          <div className={styles.cardBadge}>CPA</div>
          <h2 className={styles.cardTitle}>CPA</h2>
          <p className={styles.cardDesc}>
            Условия CPA и подключение новых офферов
          </p>
          <a
            href="https://t.me/imbabetofficial"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cardContact}
          >
            <TelegramIcon />
            @imbabetofficial
          </a>
        </div>
      </div>
    </>
  );
};

export default Page;
