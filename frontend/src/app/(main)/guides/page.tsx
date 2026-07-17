import Link from "next/link";

import { makeMetadata } from "~/shared/lib";

import styles from "./guides.module.css";

export const metadata = makeMetadata("Помощь", {
  description:
    "Полезные инструкции Imba.bet: пополнение Kaspi, вывод средств и бонусы для игроков из Казахстана.",
  path: "/guides",
});

const GUIDES = [
  { href: "/guides/kaspi", title: "Пополнение через Kaspi" },
  { href: "/guides/vyvod", title: "Вывод средств" },
  { href: "/guides/bonusy", title: "Welcome-бонус 40%" },
];

export default function GuidesIndexPage() {
  return (
    <article className={styles.wrapper}>
      <nav className={styles.nav}>
        <Link href="/">← На главную</Link>
      </nav>
      <h1 className={styles.title}>Помощь Imba.bet</h1>
      <p className={styles.lead}>
        Краткие инструкции по пополнению, выводу и бонусам. Если останутся вопросы — напишите в
        поддержку через Telegram или на support@imbalance.click.
      </p>
      <ul>
        {GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href}>{guide.title}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
