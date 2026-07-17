"use client";

import type { KickStatus } from "@/entities/kick/api";

import styles from "./KickBrandHoursOffer.module.css";

const CONNECT_BONUS = 10;
const MIN_WITHDRAW = 50;

type Props = {
  status: KickStatus | null;
};

export function KickBrandHoursOffer({ status }: Props) {
  if (!status?.connected) return null;

  const bonusReceived = status.connectBonusGranted;
  const bonusLocked = status.connectBonusLocked;

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Welcome-бонус за подключение Kick</h2>
        <span className={styles.badge}>$</span>
      </div>

      <p className={styles.desc}>
        После первого подключения Kick-канала к партнёрскому аккаунту вы получаете{" "}
        <strong>${CONNECT_BONUS}</strong> на баланс. Это разовый бенефит за активацию
        интеграции.
      </p>

      <div className={styles.highlight}>
        <span className={styles.amount}>${CONNECT_BONUS}</span>
        <span className={styles.per}>за подключение Kick (один раз)</span>
      </div>

      <ul className={styles.list}>
        <li>
          {bonusReceived
            ? bonusLocked
              ? "Бонус на балансе, но к выводу откроется после первой приведённой регистрации"
              : "Бонус получен и доступен к выводу вместе с остальными начислениями"
            : "Подключите Kick — бонус начислится автоматически"}
        </li>
        <li>Минимальный вывод — <strong>${MIN_WITHDRAW}</strong></li>
        <li>RevShare и CPA с депозитов приведённых игроков начисляются отдельно</li>
        <li>
          Приведено регистраций: <strong>{status.referralsCount}</strong>
        </li>
      </ul>
    </section>
  );
}
