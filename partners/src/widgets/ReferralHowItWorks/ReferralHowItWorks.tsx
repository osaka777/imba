import styles from "./ReferralHowItWorks.module.css";

const STEPS = [
  {
    num: "1",
    iconClass: styles.stepIcon_1,
    label: "Делитесь ссылкой",
    desc: "Скопируйте ссылку или промокод. Добавьте sub1–sub5 для аналитики источников.",
  },
  {
    num: "2",
    iconClass: styles.stepIcon_2,
    label: "Игрок регистрируется",
    desc: "По вашему тегу или промокоду игрок закрепляется за вами навсегда.",
  },
  {
    num: "3",
    iconClass: styles.stepIcon_3,
    label: "Игрок делает ставки",
    desc: "Комиссия начисляется с проигрышных ставок по модели RevShare.",
  },
  {
    num: "4",
    iconClass: styles.stepIcon_4,
    label: "Получаете выплату",
    desc: "Средства доступны после hold-периода. Вывод — в разделе «Выводы».",
  },
] as const;

export function ReferralHowItWorks() {
  return (
    <section className={styles.card} aria-label="Как работает партнёрская программа">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Как это работает</h2>
          <p className={styles.subtitle}>
            От ссылки до комиссии — четыре шага. Все игроки по вашему тегу учитываются автоматически.
          </p>
        </div>
        <span className={styles.badge}>RevShare · Postback · SubID</span>
      </div>

      <div className={styles.flow}>
        {STEPS.map((step) => (
          <div key={step.num} className={styles.step}>
            <div className={`${styles.stepIcon} ${step.iconClass}`}>{step.num}</div>
            <div className={styles.stepLabel}>{step.label}</div>
            <p className={styles.stepDesc}>{step.desc}</p>
          </div>
        ))}
      </div>

      <div className={styles.tipsGrid}>
        <div className={styles.tip}>
          <div className={styles.tipTitle}>
            <span className={`${styles.tipDot} ${styles.tipDot_purple}`} />
            Промокоды
          </div>
          <p className={styles.tipText}>
            Создайте до 10 кодов. Игрок вводит код при регистрации — бонус активируется после
            одобрения аккаунта.
          </p>
        </div>
        <div className={styles.tip}>
          <div className={styles.tipTitle}>
            <span className={`${styles.tipDot} ${styles.tipDot_blue}`} />
            SubID (sub1–sub5)
          </div>
          <p className={styles.tipText}>
            Метки в ссылке для отчётов: канал, креатив, гео. Пример:{" "}
            <span className={styles.tipCode}>?tag=…&amp;sub1=telegram</span>
          </p>
        </div>
        <div className={styles.tip}>
          <div className={styles.tipTitle}>
            <span className={`${styles.tipDot} ${styles.tipDot_green}`} />
            Лендинги
          </div>
          <p className={styles.tipText}>
            Соберите посадочную с матчами из линии или лайва в разделе «Лендинги» — ссылка уже
            содержит ваш тег и SubID.
          </p>
        </div>
      </div>
    </section>
  );
}
