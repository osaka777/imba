"use client";

import Image from "next/image";
import Link from "next/link";

import { AndroidIcon, KaspiLogoIcon, VisaIcon } from "~/shared/assets/icons";
import { ANDROID_APP_VERSION } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import type { PhoneMatch } from "./liveMatches";
import styles from "./appDownload.module.css";

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

type Props = {
  matches: PhoneMatch[];
};

export function AppDownloadClient({ matches }: Props) {
  const { t } = useLocale();

  const features = [
    { icon: <BoltIcon />, title: t("download.appFeatLiveTitle"), text: t("download.appFeatLiveText") },
    { icon: <CardIcon />, title: t("download.appFeatCashTitle"), text: t("download.appFeatCashText") },
    { icon: <GiftIcon />, title: t("download.appFeatBonusTitle"), text: t("download.appFeatBonusText") },
    { icon: <ChatIcon />, title: t("download.appFeatSupportTitle"), text: t("download.appFeatSupportText") },
  ];

  const steps = [
    { title: t("download.appStep1Title"), text: t("download.appStep1Text") },
    { title: t("download.appStep2Title"), text: t("download.appStep2Text") },
    { title: t("download.appStep3Title"), text: t("download.appStep3Text") },
  ];

  const whatsNew = [
    t("download.appWhatsNew1"),
    t("download.appWhatsNew2"),
    t("download.appWhatsNew3"),
    t("download.appWhatsNew4"),
  ];

  return (
    <article className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/">{t("download.backHome")}</Link>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>
            <AndroidIcon className={styles.androidIcon} />
            {t("download.appBadge", { version: ANDROID_APP_VERSION })}
          </span>

          <h1 className={styles.heroTitle}>
            {t("download.appTitleBefore")}
            <br />
            <span className={styles.heroTitleAccent}>{t("download.appTitleAccent")}</span>
          </h1>

          <p className={styles.heroLead}>{t("download.appLead")}</p>

          <div className={styles.heroActions}>
            <a className={styles.downloadBtn} download href={`/imba-bet.apk?v=${ANDROID_APP_VERSION}`}>
              <DownloadIcon />
              {t("download.appDownload")}
            </a>
            <span className={styles.heroVersion}>{t("download.appPlatform")}</span>
          </div>

          <p className={styles.heroVersion} style={{ marginTop: 14 }}>
            {t("download.appHavePc")}{" "}
            <Link href="/windows" style={{ color: "#7ee49a", textDecoration: "underline" }}>
              {t("download.appWindowsLink")}
            </Link>
          </p>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <ShieldIcon />
              {t("download.appTrustSigned")}
            </span>
            <span className={styles.trustDivider} />
            <span className={styles.trustItem}>{t("download.appTrustOfficial")}</span>
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
                <span>{t("download.appPhoneBonus")}</span>
                <b>{t("download.appPhoneBonusValue")}</b>
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
              alt={t("download.appQrAlt")}
              className={styles.qrImage}
              height={104}
              src="/images/apk-qr.png"
              width={104}
            />
            <span className={styles.qrText} style={{ whiteSpace: "pre-line" }}>
              {t("download.appQrText")}
            </span>
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
            {t("download.appWhatsNewTitle", { version: ANDROID_APP_VERSION })}
          </h2>
          <p className={styles.sectionSub}>{t("download.appWhatsNewSub")}</p>
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
          <p className={styles.sectionSub}>{t("download.appInstallSub")}</p>
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
            {t("download.appSafetyBefore")} <Link href="/">imba.bet</Link>
            {t("download.appSafetyAfter")}
          </p>
        </div>
      </section>

      <section className={styles.bottomCta}>
        <div>
          <strong>{t("download.appBottomTitle")}</strong>
          <span>{t("download.appBottomSub")}</span>
        </div>
        <div className={styles.bottomActions}>
          <a className={styles.downloadBtn} download href={`/imba-bet.apk?v=${ANDROID_APP_VERSION}`}>
            <DownloadIcon />
            {t("download.appDownloadApk")}
          </a>
          <a
            className={styles.ghostBtn}
            href="https://t.me/imbabetchat"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("download.support")}
          </a>
        </div>
      </section>
    </article>
  );
}
