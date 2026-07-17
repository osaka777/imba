"use client";

import { useCallback, useState } from "react";

import styles from "./KickStreamGuide.module.css";

const STEPS = [
  {
    min: 0,
    title: "Подключите Kick",
    text: "Нажмите «Подключить Kick» и авторизуйтесь. Welcome $10 начислится сразу — вывод откроется после первой регистрации.",
  },
  {
    min: 3,
    title: "Скопируйте короткую ссылку",
    text: "Вставьте imbalance.click/… в описание канала и закрепите в чате. Бот ответит на !imba той же ссылкой.",
  },
  {
    min: 6,
    title: "Добавьте OBS-оверлеи",
    text: "Browser Source: полоска (920×90) и алерты (420×200). Фон прозрачный, обновление автоматическое.",
  },
  {
    min: 9,
    title: "Брендинг в заголовке",
    text: "Укажите imba.bet в названии эфира или тег imba_partner — так засчитываются бренд-часы.",
  },
  {
    min: 12,
    title: "Запустите эфир",
    text: "При старте бот один раз напишет приветствие. Следите за блоком «Заработок за эфир» в кабинете.",
  },
  {
    min: 15,
    title: "Вовлекайте чат",
    text: "Напоминайте про !promo, !match и !score. Конкурс «угадай счёт» — зрители пишут !счёт 2-1. Алерты REG/FTD на стриме.",
  },
];

const SCRIPT = [
  { phase: "Старт (0–3 мин)", lines: ["Привет! Сегодня ставим на imba.bet — ссылка в описании и !imba в чате.", "Промокод для новичков — пишите !promo"] },
  { phase: "Mid-roll", lines: ["Кто ещё не зарегался — imbalance.click/ваш_ник, бонус на первый депозит.", "Угадай счёт матча — !счёт 2-1, разыграю промо среди угадавших"] },
  { phase: "Перед матчем", lines: ["Идёт катка — !score или !match, бот скинет live CS/Dota.", "Регайтесь по моей ссылке — поддержите стрим"] },
];

const CHANNEL_TEMPLATE = `🎮 Ставки на киберспорт — imbalance.click/{ваш_nick}
💰 RevShare 50% для партнёров | Welcome $10 за подключение Kick
📌 Промокод: {ваш_промо} | Чат: !imba !promo !match !score !счёт
🤝 Партнёрская программа: kick.imba.bet`;

type Props = {
  channelSlug?: string | null;
  promoCode?: string | null;
};

export function KickStreamGuide({ channelSlug, promoCode }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"steps" | "script" | "template">("steps");
  const [copied, setCopied] = useState(false);

  const slug = channelSlug?.replace(/^@/, "") ?? "ваш_nick";
  const template = CHANNEL_TEMPLATE
    .replace("{ваш_nick}", slug)
    .replace("{ваш_промо}", promoCode?.toUpperCase() ?? "PROMO");

  const copyTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [template]);

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <strong>Первый эфир за 15 минут</strong>
          <span className={styles.toggleHint}>Чеклист, скрипт и шаблон описания канала</span>
        </span>
        <span className={styles.chevron}>{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <>
          <div className={styles.tabs}>
            <button
              type="button"
              className={tab === "steps" ? styles.tabActive : styles.tab}
              onClick={() => setTab("steps")}
            >
              Шаги
            </button>
            <button
              type="button"
              className={tab === "script" ? styles.tabActive : styles.tab}
              onClick={() => setTab("script")}
            >
              Скрипт эфира
            </button>
            <button
              type="button"
              className={tab === "template" ? styles.tabActive : styles.tab}
              onClick={() => setTab("template")}
            >
              Описание канала
            </button>
          </div>

          {tab === "steps" ? (
            <ol className={styles.list}>
              {STEPS.map((step) => (
                <li key={step.min} className={styles.item}>
                  <span className={styles.time}>{step.min} мин</span>
                  <div>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {tab === "script" ? (
            <div className={styles.scriptList}>
              {SCRIPT.map((block) => (
                <div key={block.phase} className={styles.scriptBlock}>
                  <h3 className={styles.stepTitle}>{block.phase}</h3>
                  <ul className={styles.scriptLines}>
                    {block.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "template" ? (
            <div className={styles.templateBlock}>
              <textarea className={styles.templateArea} readOnly value={template} rows={6} />
              <button type="button" className={styles.copyBtn} onClick={() => void copyTemplate()}>
                {copied ? "Скопировано" : "Копировать в описание Kick"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
