import Link from "next/link";

import { makeMetadata } from "~/shared/lib";

import styles from "../guides.module.css";
import bonusStyles from "./bonusGuide.module.css";
import { BonusGuideLimits } from "./BonusGuideLimits";

export const metadata = makeMetadata("Welcome-бонус и промокоды", {
  description:
    "Как получить welcome-бонус 40% на Imba.bet: регистрация, пополнение, вейджер ×8, условия отыгрыша и вывод.",
  path: "/guides/bonusy",
});

const STEPS = [
  {
    title: "Регистрация",
    text: "В профиле появляется заблокированный welcome в вашей валюте. Играть нельзя, пока не пополните счёт.",
  },
  {
    title: "Первое пополнение",
    text: "Внесите сумму от минимума в течение 24 ч. Деньги — на основной счёт, бонус 40% — на бонусный.",
  },
  {
    title: "Отыгрыш",
    text: "Ставьте с бонусного счёта на исход или тотал, пока не наберёте оборот 8 × (депозит + бонус).",
  },
  {
    title: "Вывод",
    text: "После отыгрыша выигрыш с бонуса можно вывести в пределах 1.5× суммы депозита.",
  },
];

const WAGER_RULES = [
  { icon: "🎯", title: "Ординар", text: "Экспресс с бонуса недоступен" },
  { icon: "⚽", title: "Исход и тотал", text: "П1 / X / П2 и тоталы матча" },
  { icon: "📺", title: "Live и линия", text: "Исход и тотал — в live и прематче" },
  { icon: "📈", title: "Кэф 1.85–5", text: "Вне диапазона — не идёт в отыгрыш" },
  { icon: "🎯", title: "До 15% баланса", text: "Максимум за одну ставку с бонуса" },
];

export default function BonusGuidePage() {
  return (
    <article className={`${styles.wrapper} ${bonusStyles.page}`}>
      <nav className={styles.nav}>
        <Link href="/guides">← Все инструкции</Link>
      </nav>

      <header className={bonusStyles.hero}>
        <div className={bonusStyles.heroInner}>
          <span className={bonusStyles.heroBadge}>Welcome-бонус</span>
          <h1 className={bonusStyles.heroTitle}>40% на первый депозит</h1>
          <p className={bonusStyles.heroLead}>
            Активируй welcome после пополнения, отыграй вейджер и выводи выигрыш в рамках лимита.
            Всё в вашей валюте.
          </p>
          <div className={bonusStyles.statsRow}>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>40%</span>
              <span className={bonusStyles.statLabel}>Бонус</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>×8</span>
              <span className={bonusStyles.statLabel}>Вейджер</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>1.85–5</span>
              <span className={bonusStyles.statLabel}>Кэф</span>
            </div>
            <div className={bonusStyles.statChip}>
              <span className={bonusStyles.statValue}>24ч</span>
              <span className={bonusStyles.statLabel}>На этап</span>
            </div>
          </div>
        </div>
      </header>

      <section className={`${bonusStyles.card} ${bonusStyles.timeline}`}>
        <h2 className={bonusStyles.sectionTitle}>Как это работает</h2>
        <ol className={bonusStyles.timelineList}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={bonusStyles.timelineItem}>
              <span className={bonusStyles.timelineNum}>{index + 1}</span>
              <div className={bonusStyles.timelineBody}>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <BonusGuideLimits />

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>Правила отыгрыша</h2>
        <div className={bonusStyles.rulesGrid}>
          {WAGER_RULES.map((rule) => (
            <div key={rule.title} className={bonusStyles.ruleChip}>
              <span className={bonusStyles.ruleIcon}>{rule.icon}</span>
              <div>
                <strong>{rule.title}</strong>
                <span>{rule.text}</span>
              </div>
            </div>
          ))}
        </div>
        <ul className={bonusStyles.listPlain} style={{ marginTop: 16 }}>
          <li>Вывод заблокирован, пока бонус не отыгран полностью</li>
          <li>Не успели за 24 часа — бонус сгорает</li>
        </ul>
      </section>

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>Дополнительно</h2>
        <ul className={bonusStyles.listPlain}>
          <li>
            <strong>2-й депозит</strong> — reload 20% (если нет активного отыгрыша)
          </li>
          <li>
            <strong>3-й депозит</strong> — reload 10%
          </li>
          <li>
            <strong>Кэшбэк</strong> — 5% от проигрыша за неделю (по понедельникам)
          </li>
          <li>Welcome — один раз на IP, устройство и платёжный метод</li>
        </ul>
      </section>

      <section className={bonusStyles.card}>
        <h2 className={bonusStyles.sectionTitle}>Промокоды</h2>
        <ol className={bonusStyles.orderedList}>
          <li>Войдите в аккаунт.</li>
          <li>Откройте раздел промокодов в профиле.</li>
          <li>Введите код при регистрации или вручную в профиле.</li>
        </ol>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile">
          Пополнить счёт
        </Link>
        <Link className={styles.link} href="/profile/promocodes">
          Промокоды
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/info">
          Правила
        </Link>
      </div>
    </article>
  );
}
