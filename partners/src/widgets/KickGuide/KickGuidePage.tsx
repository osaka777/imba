import Link from "next/link";
import Image from "next/image";

import { LogoWhiteIcon } from "@/shared/assets";

import {
  CHANNEL_TEMPLATE,
  CHAT_COMMANDS,
  GUIDE_FAQ,
  GUIDE_SCRIPT,
  GUIDE_STEPS_15MIN,
  GUIDE_TOC,
  HOWTO_STEPS,
} from "./kick-guide-data";
import styles from "./kick-guide.module.css";

const SUPPORT_MANAGER = "https://t.me/imbabetofficial";

export function KickGuidePage() {
  return (
    <div className={styles.page} lang="ru">
      <div className={styles.grid} aria-hidden />
      <div className={styles.glowA} aria-hidden />
      <div className={styles.glowB} aria-hidden />

      <header className={styles.topbar}>
        <div className={styles.brandWrap}>
          <Image
            src={LogoWhiteIcon}
            alt="imba.bet"
            width={110}
            height={18}
            priority
          />
          <span className={styles.brandKick}>
            × <b>Kick</b> Guide
          </span>
        </div>
        <div className={styles.topActions}>
          <Link className={styles.topLink} href="/">
            На главную
          </Link>
          <Link className={styles.ctaTop} href="/#join">
            Регистрация →
          </Link>
        </div>
      </header>

      <article className={styles.wrap}>
        <p className={styles.eyebrow}>Практический гид</p>
        <h1 className={styles.title}>
          Как монетизировать Kick-стрим через партнёрку imba.bet
        </h1>
        <p className={styles.lead}>
          Пошаговая инструкция для стримеров из Казахстана и России: подключение
          Kick, партнёрские ссылки, чат-бот, OBS-оверлей, RevShare до 50% и
          выплаты в USDT. Без воды — только то, что реально настроено в кабинете
          kick.imba.bet.
        </p>

        <nav className={styles.toc} aria-label="Содержание гида">
          <p className={styles.tocTitle}>Содержание</p>
          <ol className={styles.tocList}>
            {GUIDE_TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section className={styles.section} id="komu-podhodit">
          <h2>Кому подходит партнёрка Kick × imba</h2>
          <p>
            Программа рассчитана на стримеров Kick, которые ведут киберспорт,
            ставки или развлекательные эфиры для аудитории KZ и RU. Если у вас
            уже есть зрители, которые интересуются ставками — вы можете
            монетизировать трафик через RevShare, а не только через донаты.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Стримеры Kick</strong> — киберспорт, CS2, Dota 2, live-ставки
            </li>
            <li>
              <strong>Арбитражники трафика</strong> — короткие ссылки imbalance.click
              и аналитика по sub1=kick
            </li>
            <li>
              <strong>Новички на Kick</strong> — welcome $10 за подключение канала
              и готовый чеклист первого эфира
            </li>
          </ul>
          <p>
            Доход зависит от качества трафика: переходов по ссылке, регистраций
            и активности игроков. Это не пассивный заработок — нужны эфиры и
            работа с чатом.
          </p>
        </section>

        <section className={styles.section} id="chto-nuzhno">
          <h2>Что нужно до старта</h2>
          <ul className={styles.list}>
            <li>
              <strong>Kick-канал</strong> — активный или готовый к запуску
            </li>
            <li>
              <strong>Email</strong> для регистрации партнёрского аккаунта на
              kick.imba.bet
            </li>
            <li>
              <strong>OBS</strong> (опционально) — для оверлея 920×90 и алертов
              420×200
            </li>
            <li>
              <strong>Telegram</strong> — для связи с менеджером @imbabetofficial
            </li>
          </ul>
          <p>
            Отдельный сайт или блог не нужны. Вся инфраструктура — в кабинете
            партнёра: ссылки, бот, виджеты и аналитика эфира.
          </p>
        </section>

        <section className={styles.section} id="podklyuchenie">
          <h2>Подключение за 3 шага</h2>
          <ol className={styles.stepsList}>
            {HOWTO_STEPS.map((step, index) => (
              <li className={styles.stepItem} key={step.name}>
                <span className={styles.stepNum}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.stepBody}>
                  <h3>{step.name}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p>
            После OAuth бот подключается к чату автоматически. Welcome $10
            начисляется на баланс партнёра сразу. Вывод средств открывается
            после первой регистрации игрока по вашей ссылке, минимум — $50.
          </p>
        </section>

        <section className={styles.section} id="pervyy-efir">
          <h2>Первый эфир за 15 минут</h2>
          <p>
            Чеклист для запуска монетизации с нуля. Каждый пункт — конкретное
            действие в кабинете или на стриме.
          </p>
          <ol className={styles.stepsList}>
            {GUIDE_STEPS_15MIN.map((step) => (
              <li className={styles.stepItem} key={step.min}>
                <span className={styles.timelineMin}>{step.min} мин</span>
                <div className={styles.stepBody}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} id="skript-efira">
          <h2>Скрипт эфира</h2>
          <p>
            Готовые фразы для чата Kick. Адаптируйте под свой стиль, но
            сохраняйте ссылку и команды бота — именно они конвертируют зрителей
            в регистрации.
          </p>
          {GUIDE_SCRIPT.map((block) => (
            <div className={styles.scriptBlock} key={block.phase}>
              <h3>{block.phase}</h3>
              <ul className={styles.scriptLines}>
                {block.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={styles.section} id="opisanie-kanala">
          <h2>Шаблон описания канала Kick</h2>
          <p>
            Вставьте в описание профиля Kick. Замените{" "}
            <strong>{"{ваш_nick}"}</strong> на ник канала и{" "}
            <strong>{"{ваш_промо}"}</strong> на промокод из кабинета.
          </p>
          <div className={styles.preBlock}>
            <pre>{CHANNEL_TEMPLATE}</pre>
          </div>
          <p>
            Короткая ссылка imbalance.click/ник удобнее длинного реферального
            URL — зрители чаще переходят по ней из мобильного чата.
          </p>
        </section>

        <section className={styles.section} id="obs-overlay">
          <h2>OBS: оверлей и алерты</h2>
          <p>
            В кабинете «Стрим» скопируйте URL виджетов и добавьте в OBS как
            Browser Source:
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Полоска</strong> — 920×90 px, прозрачный фон, показывает
              партнёрскую информацию на стриме
            </li>
            <li>
              <strong>Алерты</strong> — 420×200 px, уведомления о регистрациях
              (REG) и первых депозитах (FTD) в реальном времени
            </li>
          </ul>
          <p>
            URL виджета формата partners.imba.bet/widget/{"{partner_uid}"} —
            уникален для каждого партнёра и доступен после регистрации. Алерты:
            partners.imba.bet/widget/{"{partner_uid}"}/alerts.
          </p>
        </section>

        <section className={styles.section} id="komandy-chata">
          <h2>Команды чата Kick</h2>
          <p>
            Бот отвечает в чате вашего канала после OAuth-подключения. Команды
            снижают нагрузку на модераторов — зрители сами получают ссылку и
            промо.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Команда</th>
                <th>Что делает</th>
              </tr>
            </thead>
            <tbody>
              {CHAT_COMMANDS.map((row) => (
                <tr key={row.cmd}>
                  <td>
                    <code>{row.cmd}</code>
                  </td>
                  <td>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.section} id="vyplaty">
          <h2>Выплаты, RevShare и USDT</h2>
          <p>
            <strong>RevShare</strong> — от 50% GGR с каждого приведённого игрока.
            Ставка может быть повышена индивидуально после стабильного объёма
            трафика.
          </p>
          <p>
            <strong>Welcome $10</strong> — фиксированный бонус за регистрацию
            партнёра и подключение Kick. Начисляется сразу, вывод — после первой
            регистрации игрока по вашей ссылке.
          </p>
          <p>
            <strong>Минимальный вывод</strong> — $50. Выплаты партнёрам — в
            USDT. По RevShare базовый график — каждый вторник; активным
            партнёрам доступен вывод в любое время.
          </p>
          <p>
            Вопросы по оферу и индивидуальным ставкам — менеджер{" "}
            <a href={SUPPORT_MANAGER} rel="noreferrer" target="_blank">
              @imbabetofficial
            </a>
            .
          </p>
        </section>

        <section className={styles.section} id="faq">
          <h2>Частые вопросы</h2>
          {GUIDE_FAQ.map((item) => (
            <div className={styles.faqItem} key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </section>

        <div className={styles.ctaBlock}>
          <h2>Готовы подключить Kick?</h2>
          <p>
            Регистрация занимает 2 минуты. Welcome $10 — после подключения канала.
          </p>
          <Link className={styles.ctaBtn} href="/#join">
            Зарегистрироваться на kick.imba.bet
          </Link>
        </div>
      </article>

      <footer className={styles.footer}>
        <span>imba.bet × Kick Partners</span>
        <div className={styles.footerLinks}>
          <Link href="/">Главная</Link>
          <Link href="/guide">Гид</Link>
          <a href={SUPPORT_MANAGER} rel="noreferrer" target="_blank">
            Менеджер
          </a>
          <Link href="https://imba.bet" rel="noreferrer" target="_blank">
            imba.bet
          </Link>
        </div>
      </footer>
    </div>
  );
}
