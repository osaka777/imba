"use client";

import { useCurrency } from "~/shared/model/useCurrency";
import {
  formatWelcomeMoney,
  getWelcomeLimit,
} from "~/entities/game/ui/LuckyDrive/welcomeBonusLimits";

import styles from "./bonusGuide.module.css";

export function BonusGuideLimits() {
  const { currency } = useCurrency();
  const limit = getWelcomeLimit(currency);

  const exampleDeposit = limit.minDeposit * 2;
  const exampleBonus = Math.min(
    Math.floor(exampleDeposit * 0.4),
    limit.maxBonus,
  );
  const exampleWager = (exampleDeposit + exampleBonus) * 8;

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Лимиты — {limit.label}</h2>
      <div className={styles.limitCard}>
        <div className={styles.limitStat}>
          <span className={styles.limitStatLabel}>Мин. депозит</span>
          <span className={styles.limitStatValue}>
            {formatWelcomeMoney(limit.minDeposit, limit.currency)}
          </span>
        </div>
        <div className={styles.limitStat}>
          <span className={styles.limitStatLabel}>Макс. бонус</span>
          <span className={styles.limitStatValue}>
            до {formatWelcomeMoney(limit.maxBonus, limit.currency)}
          </span>
        </div>
      </div>
      <p className={styles.note}>
        <strong>Пример:</strong> депозит {formatWelcomeMoney(exampleDeposit, limit.currency)} → бонус{" "}
        {formatWelcomeMoney(exampleBonus, limit.currency)} → вейджер{" "}
        {formatWelcomeMoney(exampleWager, limit.currency)} оборота (×8).
      </p>
    </section>
  );
}
