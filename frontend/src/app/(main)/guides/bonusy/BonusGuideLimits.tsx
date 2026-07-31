"use client";

import { useCurrency } from "~/shared/model/useCurrency";
import { useLocale } from "~/shared/model/useLocale";
import {
  currencyLabel,
  formatWelcomeMoney,
  getWelcomeLimit,
} from "~/entities/game/ui/LuckyDrive/welcomeBonusLimits";

import styles from "./bonusGuide.module.css";

export function BonusGuideLimits() {
  const { currency } = useCurrency();
  const { t } = useLocale();
  const limit = getWelcomeLimit(currency);

  const exampleDeposit = limit.minDeposit * 2;
  const exampleBonus = Math.min(
    Math.floor(exampleDeposit * 0.4),
    limit.maxBonus,
  );
  const exampleWager = (exampleDeposit + exampleBonus) * 8;

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>
        {t("guides.bonusLimitsTitle", { label: currencyLabel(limit.currency, t) })}
      </h2>
      <div className={styles.limitCard}>
        <div className={styles.limitStat}>
          <span className={styles.limitStatLabel}>{t("guides.bonusMinDeposit")}</span>
          <span className={styles.limitStatValue}>
            {formatWelcomeMoney(limit.minDeposit, limit.currency)}
          </span>
        </div>
        <div className={styles.limitStat}>
          <span className={styles.limitStatLabel}>{t("guides.bonusMaxBonus")}</span>
          <span className={styles.limitStatValue}>
            {t("guides.bonusMaxBonusUpTo", {
              amount: formatWelcomeMoney(limit.maxBonus, limit.currency),
            })}
          </span>
        </div>
      </div>
      <p className={styles.note}>
        <strong>
          {t("guides.bonusExample", {
            deposit: formatWelcomeMoney(exampleDeposit, limit.currency),
            bonus: formatWelcomeMoney(exampleBonus, limit.currency),
            wager: formatWelcomeMoney(exampleWager, limit.currency),
          })}
        </strong>
      </p>
    </section>
  );
}
