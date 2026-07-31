"use client";

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";

import { LogoWhiteIcon } from "~/shared/assets";
import { AI_ACCESS_DENIED_NOTICE } from "~/shared/lib/aiBotDetection";
import { detectBrowserAutomation } from "~/shared/lib/automationDetection";

import styles from "./AutomationGate.module.css";

/**
 * Blocks Selenium / automated Chrome (webdriver=true) from mounting the BK UI.
 * Real players and native WebViews are unaffected.
 */
export function AutomationGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const hit =
      detectBrowserAutomation()
      || document.documentElement.getAttribute("data-imba-bot") === "1";
    if (hit) {
      document.documentElement.removeAttribute("data-imba-bot");
      setBlocked(true);
    }
  }, []);

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="imba-denied-title">
      <div className={styles.shell}>
        <div className={styles.card}>
          <Image
            alt="Imba.bet"
            className={styles.logo}
            height={40}
            priority
            src={LogoWhiteIcon}
            width={168}
          />
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            Access denied
          </div>
          <h1 className={styles.title} id="imba-denied-title">
            Доступ закрыт
          </h1>
          <p className={styles.lead}>
            Автоматизированный доступ и ИИ-агенты к imba.bet запрещены.
          </p>
          <hr className={styles.divider} />
          <div className={styles.notice}>
            <span className={styles.noticeLabel}>RU</span>
            <p>{AI_ACCESS_DENIED_NOTICE.ru}</p>
          </div>
          <div className={`${styles.notice} ${styles.noticeEn}`}>
            <span className={styles.noticeLabel}>EN</span>
            <p>{AI_ACCESS_DENIED_NOTICE.en}</p>
          </div>
          <p className={styles.foot}>
            Официальный сайт:{" "}
            <a href="https://imba.bet/">imba.bet</a>
          </p>
        </div>
      </div>
    </div>
  );
}
