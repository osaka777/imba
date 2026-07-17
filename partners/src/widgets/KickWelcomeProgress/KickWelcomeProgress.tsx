"use client";

import type { KickStatus } from "@/entities/kick/api";

import styles from "./KickWelcomeProgress.module.css";

type Props = {
  status: KickStatus | null;
};

const STEPS = [
  { key: "stepConnect", label: "Подключить Kick" },
  { key: "stepBonus", label: "Welcome $10" },
  { key: "stepReferral", label: "1 регистрация" },
  { key: "stepWithdraw", label: "Вывод $50" },
] as const;

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export function KickWelcomeProgress({ status }: Props) {
  if (!status) return null;

  const progress = status.welcomeProgress;
  const activeIndex = STEPS.findIndex((step) => !progress[step.key]);
  const currentIndex = activeIndex === -1 ? STEPS.length - 1 : activeIndex;

  let hint = "Подключите Kick-канал — получите $10 на баланс.";
  if (progress.stepConnect && !progress.stepBonus) {
    hint = "Завершите OAuth — welcome $10 начислится автоматически.";
  } else if (progress.stepBonus && !progress.stepReferral) {
    hint = `Бонус ${formatUsd(progress.lockedUsd)} на балансе, но заблокирован до первой регистрации по вашей ссылке.`;
  } else if (progress.stepReferral && !progress.stepWithdraw) {
    const left = Math.max(0, progress.minWithdrawUsd - progress.availableUsd);
    hint = `Бонус разблокирован. До минимального вывода ${formatUsd(progress.minWithdrawUsd)} осталось ${formatUsd(left)}.`;
  } else if (progress.stepWithdraw) {
    hint = `Доступно к выводу ${formatUsd(progress.availableUsd)} — можно запросить выплату.`;
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Путь к welcome $10 и выводу</h2>
          <p className={styles.subtitle}>
            Подключение → бонус → первая регистрация → минимум для вывода
          </p>
        </div>
        <span className={styles.badge}>Kick</span>
      </div>

      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const done = progress[step.key];
          const active = !done && index === currentIndex;
          return (
            <div key={step.key} className={styles.step}>
              <span
                className={[
                  styles.dot,
                  done ? styles.dotDone : "",
                  active ? styles.dotActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={[styles.label, done ? styles.labelDone : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.barWrap}>
        <div className={styles.barMeta}>
          <span>До вывода ({formatUsd(progress.minWithdrawUsd)})</span>
          <span>{progress.progressToWithdrawPct}%</span>
        </div>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${progress.progressToWithdrawPct}%` }}
          />
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Доступно</span>
          <span className={styles.statValue}>
            {formatUsd(progress.availableUsd)}
          </span>
        </div>
        {progress.lockedUsd > 0 ? (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Заблокировано</span>
            <span className={[styles.statValue, styles.statLocked].join(" ")}>
              {formatUsd(progress.lockedUsd)}
            </span>
          </div>
        ) : null}
        <div className={styles.stat}>
          <span className={styles.statLabel}>Регистраций</span>
          <span className={styles.statValue}>{status.referralsCount}</span>
        </div>
      </div>

      <p className={styles.hint}>{hint}</p>
    </section>
  );
}
