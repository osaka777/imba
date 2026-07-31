"use client";

import Link from "next/link";

import { ANDROID_APP_VERSION, WINDOWS_APP_VERSION } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import styles from "../app/appDownload.module.css";

const WindowsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="17" height="17">
    <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm8.2-1.3L21 2.8v8.7h-9.8V4.2ZM3 13.5h7.5v7.1L3 19.5v-6Zm8.2 0H21v8.7l-9.8-1.4v-7.3Z" />
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

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 20h8M12 17v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

export function WindowsDownloadClient() {
  const { t } = useLocale();

  const features = [
    { icon: <BoltIcon />, title: t("download.winFeatLiveTitle"), text: t("download.winFeatLiveText") },
    { icon: <CardIcon />, title: t("download.winFeatCashTitle"), text: t("download.winFeatCashText") },
    { icon: <MonitorIcon />, title: t("download.winFeatWindowTitle"), text: t("download.winFeatWindowText") },
    { icon: <BoltIcon />, title: t("download.winFeatUpdateTitle"), text: t("download.winFeatUpdateText") },
    { icon: <ChatIcon />, title: t("download.winFeatSupportTitle"), text: t("download.winFeatSupportText") },
  ];

  const steps = [
    { title: t("download.winStep1Title"), text: t("download.winStep1Text") },
    { title: t("download.winStep2Title"), text: t("download.winStep2Text") },
    { title: t("download.winStep3Title"), text: t("download.winStep3Text") },
  ];

  const whatsNew = [
    t("download.winWhatsNew1"),
    t("download.winWhatsNew2"),
    t("download.winWhatsNew3"),
    t("download.winWhatsNew4"),
  ];

  return (
    <article className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/">{t("download.backHome")}</Link>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>
            <WindowsIcon />
            {t("download.winBadge", { version: WINDOWS_APP_VERSION })}
          </span>

          <h1 className={styles.heroTitle}>
            {t("download.winTitleBefore")}
            <br />
            <span className={styles.heroTitleAccent}>{t("download.winTitleAccent")}</span>
          </h1>

          <p className={styles.heroLead}>{t("download.winLead")}</p>

          <div className={styles.heroActions}>
            <a
              className={styles.downloadBtn}
              download
              href={`/imba-bet-windows-setup.exe?v=${WINDOWS_APP_VERSION}`}
            >
              <DownloadIcon />
              {t("download.winDownload")}
            </a>
            <span className={styles.heroVersion}>{t("download.winPlatform")}</span>
          </div>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <ShieldIcon />
              {t("download.winTrustOfficial")}
            </span>
            <span className={styles.trustDivider} />
            <span className={styles.trustItem}>{t("download.winTrustShortcut")}</span>
          </div>

          <p className={styles.heroVersion} style={{ marginTop: 14 }}>
            {t("download.winAlsoAndroid")}{" "}
            <Link href="/app" style={{ color: "#7ee49a", textDecoration: "underline" }}>
              {t("download.winAndroidLink", { version: ANDROID_APP_VERSION })}
            </Link>
          </p>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.phone} style={{ maxWidth: 360, aspectRatio: "16 / 10" }}>
            <div className={styles.phoneScreen}>
              <div className={styles.phoneStatus}>
                <span className={styles.phoneTime}>IMBA BET</span>
                <span className={styles.phoneSignal}>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className={styles.phoneLogo}>
                IMB<span>Δ</span>BET
              </div>
              <div className={styles.phoneMatch}>
                <div className={styles.phoneMatchHeader}>
                  <span className={styles.phoneLive}>WINDOWS</span>
                  <span className={styles.phoneLeague}>{t("download.winPhoneLeague")}</span>
                </div>
                <div className={styles.phoneTeamRow}>
                  <span className={styles.phoneTeamName}>{t("download.winPhoneLine1")}</span>
                </div>
                <div className={styles.phoneTeamRow}>
                  <span className={styles.phoneTeamName}>{t("download.winPhoneLine2")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.features}>
        {features.map((feature) => (
          <div key={feature.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <strong>{feature.title}</strong>
            <span className={styles.featureText}>{feature.text}</span>
          </div>
        ))}
      </section>

      <section className={styles.whatsNew}>
        <div className={styles.installHead}>
          <h2 className={styles.sectionTitle}>
            {t("download.winWhatsNewTitle", { version: WINDOWS_APP_VERSION })}
          </h2>
          <p className={styles.sectionSub}>{t("download.winWhatsNewSub")}</p>
        </div>
        <ul className={styles.whatsNewList}>
          {whatsNew.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.install}>
        <div className={styles.installHead}>
          <h2 className={styles.sectionTitle}>{t("download.installTitle")}</h2>
          <p className={styles.sectionSub}>{t("download.winInstallSub")}</p>
        </div>
        <ol className={styles.stepsRow}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.stepCard}>
              <span className={styles.stepNum}>{index + 1}</span>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.safety}>
        <span className={styles.safetyIcon}>
          <ShieldIcon />
        </span>
        <div>
          <strong>{t("download.safetyTitle")}</strong>
          <p>
            {t("download.winSafetyBefore")} <Link href="/">imba.bet</Link> {t("download.winSafetyMid")}{" "}
            <Link href="/windows">/windows</Link>
            {t("download.winSafetyAfter")}
          </p>
        </div>
      </section>

      <section className={styles.bottomCta}>
        <div>
          <strong>{t("download.winBottomTitle")}</strong>
          <span>{t("download.winBottomSub")}</span>
        </div>
        <div className={styles.bottomActions}>
          <a
            className={styles.downloadBtn}
            download
            href={`/imba-bet-windows-setup.exe?v=${WINDOWS_APP_VERSION}`}
          >
            <DownloadIcon />
            {t("download.winDownloadSetup")}
          </a>
          <Link className={styles.ghostBtn} href="/app">
            {t("download.winAndroidApk")}
          </Link>
        </div>
      </section>
    </article>
  );
}
