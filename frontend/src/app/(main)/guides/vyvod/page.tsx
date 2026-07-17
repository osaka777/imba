import Link from "next/link";

import { makeMetadata } from "~/shared/lib";

import styles from "../guides.module.css";

export const metadata = makeMetadata("Вывод средств", {
  description:
    "Как вывести выигрыш с Imba.bet: заявка на вывод, сроки обработки Kaspi и USDT, что проверить перед отправкой.",
  path: "/guides/vyvod",
});

export default function WithdrawGuidePage() {
  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/guides">← Все инструкции</Link>
      </nav>
      <h1 className={styles.title}>Вывод средств с Imba.bet</h1>
      <p className={styles.lead}>
        Вывод выполняется через заявку в личном кабинете. Доступные способы зависят от валюты счёта
        и настроек аккаунта.
      </p>

      <section className={styles.section}>
        <h2>Как оформить вывод</h2>
        <ol>
          <li>Откройте профиль → раздел вывода или истории финансов.</li>
          <li>Выберите способ (KZT, USDT TRC-20 и др.).</li>
          <li>Укажите сумму и реквизиты.</li>
          <li>Дождитесь обработки заявки службой поддержки.</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Перед выводом</h2>
        <ul>
          <li>Убедитесь, что бонусный баланс отыгран, если использовали акцию.</li>
          <li>Проверьте реквизиты — ошибка в номере карты или кошелька задержит выплату.</li>
          <li>При первом выводе может потребоваться дополнительная проверка аккаунта.</li>
        </ul>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile/financeHistory">
          История операций
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/">
          На главную
        </Link>
      </div>
    </article>
  );
}
