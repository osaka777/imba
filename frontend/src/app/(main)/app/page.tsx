import Image from "next/image";
import Link from "next/link";

import { AndroidIcon, KaspiLogoIcon, VisaIcon } from "~/shared/assets/icons";
import { ANDROID_APP_VERSION, makeMetadata } from "~/shared/lib";

import { getPhoneMatches } from "./liveMatches";
import styles from "./appDownload.module.css";

export const revalidate = 120;

export const metadata = makeMetadata("Скачать приложение", {
  description:
    "Официальное Android-приложение Imba.bet: live, линия, Kaspi, бонусы и поддержка 24/7.",
  path: "/app",
});

const BoltIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const CardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="9" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 9v11M4 13h16" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 9c-1.8 0-4.5-.6-4.5-2.7C7.5 4.6 9 4 10 4.6c1.3.8 2 3 2 4.4Zm0 0c1.8 0 4.5-.6 4.5-2.7C16.5 4.6 15 4 14 4.6c-1.3.8-2 3-2 4.4Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5h.5A2.5 2.5 0 0 1 4 14.5v-8Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3 5 5.8v5.4c0 4.3 3 8 7 9.8 4-1.8 7-5.5 7-9.8V5.8L12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m9 11.6 2.2 2.2L15.4 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FEATURES = [
  {
    icon: <BoltIcon />,
    title: "Live и линия",
    text: "Полная роспись, быстрые коэффициенты — как на сайте",
  },
  {
    icon: <CardIcon />,
    title: "Kaspi и USDT",
    text: "Депозит и вывод в той же кассе, что и в браузере",
  },
  {
    icon: <GiftIcon />,
    title: "Все бонусы",
    text: "Welcome 40%, кэшбэк 5% и промокоды работают в приложении",
  },
  {
    icon: <ChatIcon />,
    title: "Поддержка 24/7",
    text: "Чат и Telegram — прямо из приложения",
  },
];

const STEPS = [
  {
    title: "Скачайте APK",
    text: "Файл imba-bet.apk весит 2.5 МБ — загрузится за пару секунд.",
  },
  {
    title: "Разрешите установку",
    text: "Android спросит разрешение на установку из браузера — подтвердите.",
  },
  {
    title: "Откройте приложение",
    text: "Тот же аккаунт и баланс, что на сайте. Ничего настраивать не нужно.",
  },
];

export default async function AppDownloadPage() {
  const matches = await getPhoneMatches();

  return (
    <article className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/">← На главную</Link>
      </nav>

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>
            <AndroidIcon className={styles.androidIcon} />
            Android · v{ANDROID_APP_VERSION} · 3.0 МБ
          </span>

          <h1 className={styles.heroTitle}>
            Imba.bet всегда
            <br />
            <span className={styles.heroTitleAccent}>под рукой</span>
          </h1>

          <p className={styles.heroLead}>
            Официальное приложение. Тот же аккаунт, касса и линия — обновления
            подтягиваются с сайта автоматически.
          </p>

          <div className={styles.heroActions}>
            <a className={styles.downloadBtn} download href="/imba-bet.apk">
              <DownloadIcon />
              Скачать для Android
            </a>
            <span className={styles.heroVersion}>Android 7.0+ · бесплатно</span>
          </div>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <ShieldIcon />
              Подписанный APK
            </span>
            <span className={styles.trustDivider} />
            <span className={styles.trustItem}>Только с imba.bet</span>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.phone}>
            <div className={styles.phoneScreen}>
              <div className={styles.phoneStatus}>
                <span className={styles.phoneTime}>21:00</span>
                <span className={styles.phoneSignal}>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className={styles.phoneLogo}>
                IMB<span>Δ</span>BET
              </div>

              {matches.map((match) => (
                <div key={match.id} className={styles.phoneMatch}>
                  <div className={styles.phoneMatchHeader}>
                    {match.isLive && <span className={styles.phoneLive}>LIVE</span>}
                    <span className={styles.phoneLeague}>
                      {match.league}
                      {match.time ? ` · ${match.time}` : ""}
                    </span>
                  </div>
                  <div className={styles.phoneTeamRow}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className={styles.phoneTeamIcon}
                      src={match.home.icon ?? "/images/default-team.svg"}
                    />
                    <span className={styles.phoneTeamName}>{match.home.name}</span>
                    <b className={styles.phoneTeamScore}>{match.home.score ?? "–"}</b>
                  </div>
                  <div className={styles.phoneTeamRow}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className={styles.phoneTeamIcon}
                      src={match.away.icon ?? "/images/default-team.svg"}
                    />
                    <span className={styles.phoneTeamName}>{match.away.name}</span>
                    <b className={styles.phoneTeamScore}>{match.away.score ?? "–"}</b>
                  </div>
                  <div className={styles.phoneOdds}>
                    {match.odds.map((odd) => (
                      <span key={odd.label}>
                        {odd.label} <b>{odd.value}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className={styles.phoneBonus}>
                <span>Welcome-бонус</span>
                <b>+40% к депозиту</b>
              </div>

              <div className={styles.phonePay}>
                <span className={styles.phonePayChip}>
                  <Image alt="Kaspi" height={14} src={KaspiLogoIcon} width={61} />
                </span>
                <span className={`${styles.phonePayChip} ${styles.phonePayVisa}`}>
                  <VisaIcon />
                </span>
                <span className={styles.phonePayChip}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className={styles.phonePayUsdtIcon} src="/currency/usdt.svg" />
                  <b className={styles.phonePayUsdtText}>USDT</b>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.qrCard}>
            <Image
              alt="QR-код для скачивания приложения"
              className={styles.qrImage}
              height={104}
              src="/images/apk-qr.png"
              width={104}
            />
            <span className={styles.qrText}>
              Наведите камеру —<br />
              APK скачается сам
            </span>
          </div>
        </div>
      </header>

      {/* ── Features ── */}
      <section className={styles.features}>
        {FEATURES.map((feature) => (
          <div key={feature.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <strong>{feature.title}</strong>
            <span className={styles.featureText}>{feature.text}</span>
          </div>
        ))}
      </section>

      {/* ── Install steps ── */}
      <section className={styles.install}>
        <div className={styles.installHead}>
          <h2 className={styles.sectionTitle}>Установка за минуту</h2>
          <p className={styles.sectionSub}>
            Google Play не размещает букмекеров — поэтому ставим напрямую.
          </p>
        </div>
        <ol className={styles.stepsRow}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.stepCard}>
              <span className={styles.stepNum}>{index + 1}</span>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Safety note ── */}
      <section className={styles.safety}>
        <span className={styles.safetyIcon}>
          <ShieldIcon />
        </span>
        <div>
          <strong>Скачивайте только здесь</strong>
          <p>
            Единственный официальный источник — <Link href="/">imba.bet</Link>. APK из
            Telegram-каналов и сторонних сайтов могут красть данные и платежи. Если
            стояла старая версия приложения — удалите её перед установкой.
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className={styles.bottomCta}>
        <div>
          <strong>Готовы начать?</strong>
          <span>Установка займёт меньше минуты</span>
        </div>
        <div className={styles.bottomActions}>
          <a className={styles.downloadBtn} download href="/imba-bet.apk">
            <DownloadIcon />
            Скачать APK
          </a>
          <a
            className={styles.ghostBtn}
            href="https://t.me/imbabetchat"
            rel="noopener noreferrer"
            target="_blank"
          >
            Поддержка
          </a>
        </div>
      </section>
    </article>
  );
}
