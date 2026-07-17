import styles from "./kick-welcome-bonus.module.css";

const PERKS = [
  "Регистрация партнёра на kick.imba.bet",
  "Подключение Kick-канала в 1 клик",
  "$10 сразу на баланс",
] as const;

export function KickWelcomeBonus() {
  return (
    <section className={styles.wrap} aria-label="Welcome-бонус">
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.left}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            Welcome bonus
          </span>
          <h2 className={styles.heading}>
            Получи
            {" "}
            <span className={styles.amount}>$10</span>
            {" "}
            за старт
          </h2>
          <p className={styles.desc}>
            Зарегистрируйся как Kick-партнёр и подключи канал — welcome-бонус начислится
            автоматически. К выводу откроется после первой приведённой регистрации,
            минимальный вывод — $50.
          </p>
          <ul className={styles.perks}>
            {PERKS.map((item) => (
              <li className={styles.perk} key={item}>
                <span className={styles.perkCheck} aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardRing} aria-hidden />
          <p className={styles.cardLabel}>Твой welcome</p>
          <p className={styles.cardAmount}>
            <span className={styles.cardCurrency}>$</span>
            10
          </p>
          <p className={styles.cardHint}>после подключения Kick</p>
          <div className={styles.cardDivider} />
          <p className={styles.cardFoot}>
            RevShare до 50%
            <br />
            + аналитика эфира
          </p>
        </div>
      </div>
    </section>
  );
}

export function KickWelcomeBonusCompact() {
  return (
    <div className={styles.compact}>
      <span className={styles.compactIcon} aria-hidden>
        $
      </span>
      <div className={styles.compactText}>
        <strong>Welcome $10</strong>
        <span>за регистрацию + подключение Kick</span>
      </div>
    </div>
  );
}
