import Link from "next/link";

import { makeMetadata } from "~/shared/lib";

import styles from "../guides.module.css";

export const metadata = makeMetadata("Пополнение через Kaspi", {
  description:
    "Как пополнить счёт Imba.bet через Kaspi и карты Казахстана: минимальный депозит от 500 ₸, сроки зачисления и типичные ошибки.",
  path: "/guides/kaspi",
});

export default function KaspiGuidePage() {
  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/guides">← Все инструкции</Link>
      </nav>
      <h1 className={styles.title}>Пополнение Imba.bet через Kaspi</h1>
      <p className={styles.lead}>
        Для игроков из Казахстана доступно пополнение в тенге (KZT), в том числе через Kaspi.
        Минимальный депозит — от 500 ₸.
      </p>

      <section className={styles.section}>
        <h2>Как пополнить</h2>
        <ol>
          <li>Войдите в аккаунт на imba.bet.</li>
          <li>Откройте раздел пополнения в профиле.</li>
          <li>Выберите способ KZT / Kaspi и укажите сумму.</li>
          <li>Следуйте инструкции на экране и дождитесь зачисления.</li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Если деньги не пришли</h2>
        <ul>
          <li>Проверьте, что перевод выполнен на реквизиты из формы пополнения.</li>
          <li>Убедитесь, что сумма не ниже минимального депозита.</li>
          <li>Обратитесь в поддержку с ID платежа или скрином чека.</li>
        </ul>
      </section>

      <div className={styles.actions}>
        <Link className={styles.link} href="/profile">
          Перейти в профиль
        </Link>
        <Link className={`${styles.link} ${styles.linkSecondary}`} href="/">
          На главную
        </Link>
      </div>
    </article>
  );
}
