"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { LogoWhiteIcon } from "~/shared/assets";

import {
  AndroidIcon,
  AppleIcon,
  ApplePayIcon,
  AstropayIcon,
  AtpIcon,
  BitcoinIcon,
  DiscoverIcon,
  EthereumIcon,
  FibaIcon,
  FifaIcon,
  FkWalletIcon,
  GPayIcon,
  InstagramIcon,
  InteracIcon,
  ItfIcon,
  JbsIcon,
  MastercardIcon,
  MuchbetterIcon,
  NhlIcon,
  PayerrIcon,
  PiastrixIcon,
  QiwiIcon,
  QuestionIcon,
  SkrillIcon,
  TelegramIcon,
  TetherIcon,
  UefaIcon,
  UfcIcon,
  VisaIcon,
  WebmoneyIcon,
  WtaIcon,
} from "~/shared/assets/icons";
import { isNativeApp } from "~/entities/push/lib/nativeApp";
import { ScrollToTopButton } from "~/shared/ui/Button";
import { useLocale } from "~/shared/model/useLocale";

import { TrustBadgesRow } from "./TrustBadgesRow";
import styles from "./Footer.module.css";

export const Footer = () => {
  const { t } = useLocale();
  const [showAppLinks, setShowAppLinks] = useState(true);

  useEffect(() => {
    setShowAppLinks(!isNativeApp());
  }, []);

  return (
    <footer className={styles.Footer}>
      <div className={styles.Footer_logoContainer}>
        <div className={styles.Footer_logoWrapper}>
          <div
            className={`${styles.SvgLogo_svgLogoContainer} ${styles.Footer_logo}`}
          >
            <Image alt="Logo" height={15} src={LogoWhiteIcon} width={100} />
          </div>
        </div>
        <div className={styles.Footer_LogoSeparator}></div>
      </div>

      <div className={styles.Footer_navSection}>
        <div className={styles.Footer_leftSection}>
          <div
            className={`${styles.ContactSection_container} ${styles.Footer_contactSection}`}
          >
            <div className={styles.ContactSection_title}>
              {t("footer.support247")}
            </div>
            <Link className={styles.ContactSection_subtitle} href="#support">
              {t("footer.supportHint")}
            </Link>
          </div>

          <div
            className={`${styles.NavigationSection_root} ${styles.Footer_navigationSection}`}
          >
            <div
              className={`${styles.NavigationSection_block} ${styles.mobileHidden}`}
            >
              <p className={styles.NavigationSection_title}>
                {t("footer.supportContacts")}
              </p>
              <div className={styles.NavigationSection_contacts}>
                <div className={styles.NavigationSection_contactsRow}>
                  <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      {t("footer.techSupport")}
                    </span>
                  </div>
                  <div className={styles.NavigationSection_contactsCell}>
                    <a
                      className={styles.NavigationSection_link}
                      href="mailto:support@imbalance.click"
                    >
                      support@imbalance.click
                    </a>
                  </div>
                </div>
                <div className={styles.NavigationSection_contactsRow}>
                  <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      {t("footer.security")}
                    </span>
                  </div>
                  <div className={styles.NavigationSection_contactsCell}>
                    <a
                      className={styles.NavigationSection_link}
                      href="mailto:security@imbalance.click"
                    >
                      security@imbalance.click
                    </a>
                  </div>
                </div>
                <div className={styles.NavigationSection_contactsRow}>
                  <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      {t("footer.business")}
                    </span>
                  </div>
                  <div className={styles.NavigationSection_contactsCell}>
                    <a
                      className={styles.NavigationSection_link}
                      href="mailto:business@imbalance.click"
                    >
                      business@imbalance.click
                    </a>
                  </div>
                </div>
                <div className={styles.NavigationSection_contactsRow}>
                  <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      {t("footer.partners")}
                    </span>
                  </div>
                  <div className={styles.NavigationSection_contactsCell}>
                    <a
                      className={styles.NavigationSection_link}
                      href="mailto:partners@imbalance.click"
                    >
                      partners@imbalance.click
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.NavigationSection_block}>
              <p className={styles.NavigationSection_title}>{t("footer.info")}</p>
              <div className={styles.NavigationInfo}>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/info"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("footer.rules")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/legal/ai-usage-policy"
                  >
                    {t("footer.aiPolicyLink")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/guides">
                    {t("footer.help")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/info"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("footer.contacts")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/app">
                    {t("footer.downloadApp")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <a
                    className={styles.NavigationSection_link}
                    href="https://partners.imba.bet"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("footer.partners")}
                  </a>
                </div>
              </div>
            </div>

            <div
              className={`${styles.NavigationSection_block} ${styles.NavigationSection_blockCategories}`}
            >
              <p className={styles.NavigationSection_title}>
                {t("footer.categories")}
              </p>
              <div className={styles.NavigationInfo}>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/live">
                    Live
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/line">
                    {t("nav.line")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/cybersport"
                  >
                    {t("nav.cyberShort")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/markets"
                  >
                    {t("nav.markets")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/trading"
                  >
                    {t("nav.btc")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/trading/race"
                  >
                    {t("nav.imbaGames")}
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/results"
                  >
                    {t("nav.results")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAppLinks ? (
          <div
            className={`${styles.ApplicationSection_container} ${styles.Footer_applicationSection}`}
          >
            <div className={styles.ApplicationSection_grid}>
              <div className={styles.ApplicationSection_mobileColumn}>
                <div
                  className={`${styles.FooterMobileApps_container} ${styles.FooterMobileApps_inactive}`}
                  aria-disabled="true"
                >
                  <AppleIcon
                    className={`${styles.FooterMobileApps_icon} ${styles.FooterMobileApps_iconIos}`}
                  />
                  <div className={styles.FooterMobileApps_text}>
                    <div className={styles.FooterMobileApps_title}>
                      {t("footer.appLabel")}
                    </div>
                    <div className={styles.FooterMobileApps_subtitle}>
                      {t("footer.appIos")}
                    </div>
                  </div>
                  <QuestionIcon className={styles.FooterMobileApps_question} />
                </div>
                <Link
                  className={styles.FooterMobileApps_container}
                  href="/app"
                >
                  <AndroidIcon
                    className={`${styles.FooterMobileApps_icon} ${styles.FooterMobileApps_iconAndroid}`}
                  />
                  <div className={styles.FooterMobileApps_text}>
                    <div className={styles.FooterMobileApps_title}>
                      {t("footer.appLabel")}
                    </div>
                    <div className={styles.FooterMobileApps_subtitle}>
                      {t("footer.appAndroid")}
                    </div>
                  </div>
                  <QuestionIcon className={styles.FooterMobileApps_question} />
                </Link>
              </div>

              <Link
                className={styles.FooterWindowsApp}
                href="/windows"
                aria-label={t("footer.downloadWindows")}
              >
                <div className={styles.FooterWindowsApp_top}>
                  <span className={styles.FooterWindowsApp_badge} aria-hidden>
                    <svg
                      className={styles.FooterWindowsApp_logo}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm8.2-1.3L21 2.8v8.7h-9.8V4.2ZM3 13.5h7.5v7.1L3 19.5v-6Zm8.2 0H21v8.7l-9.8-1.4v-7.3Z" />
                    </svg>
                  </span>
                  <span className={styles.FooterWindowsApp_chevron} aria-hidden>
                    ›
                  </span>
                </div>
                <div className={styles.FooterWindowsApp_text}>
                  <div className={styles.FooterMobileApps_title}>
                    {t("footer.appLabel")}
                  </div>
                  <div className={styles.FooterWindowsApp_subtitle}>
                    {t("footer.appWindows")}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.Footer_middleSeparator}></div>

      <div className={styles.Footer_promotionSection}>
        <div className={styles.SocialList_root}>
          <ul className={styles.SocialList_list}>
            <li className={styles.SocialList_item}>
              <a
                className={`${styles.SocialList_link} ${styles.SocialItemWrapper_telegram}`}
                href="https://t.me/imbabetchat"
                id="support"
                rel="noopener noreferrer"
                target="_blank"
              >
                <TelegramIcon />
              </a>
            </li>
            <li className={styles.SocialList_item}>
              <a
                className={`${styles.SocialList_link} ${styles.SocialItemWrapper_instagram}`}
                href="https://www.instagram.com/imba.bets/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <InstagramIcon />
              </a>
            </li>
          </ul>
        </div>
        <div className={styles.SportsPromotionSection_root}>
          <UefaIcon />
          <UfcIcon height="25" width="75" />
          <WtaIcon alt="WTA" height="25" width="33.333333333333336" />
          <FibaIcon alt="FIBA" height="25" loading="lazy" width="55" />
          <NhlIcon alt="NHL" height="25" loading="lazy" width="25" />
          <AtpIcon
            alt="ATP"
            height="25"
            loading="lazy"
            width="21.666666666666668"
          />
          <ItfIcon
            alt="ITF"
            height="25"
            loading="lazy"
            width="56.66666666666667"
          />
          <FifaIcon
            alt="FIFA"
            height="25"
            loading="lazy"
            width="76.66666666666667"
          />
        </div>
        <div className={styles.ChangeLanguageSection_container}>
          <ScrollToTopButton />
        </div>
      </div>

      <div
        className={`${styles.Footer_rowSeparator} ${styles.mobileHidden}`}
        aria-hidden
      />

      <div
        className={`${styles.PaymentSection_container} ${styles.mobileHidden}`}
      >
        <VisaIcon
          className={`${styles.icon} ${styles.iconPaymentFullVisaIcon} ${styles.PaymentSection_icon}`}
        />
        <MastercardIcon
          className={`${styles.icon} ${styles.iconPaymentFullMastercardIcon} ${styles.PaymentSection_icon}`}
        />
        <GPayIcon
          className={`${styles.icon} ${styles.iconPaymentFullGPayIcon} ${styles.PaymentSection_icon}`}
        />
        <ApplePayIcon
          className={`${styles.icon} ${styles.iconPaymentFullAppleIcon} ${styles.PaymentSection_icon}`}
        />
        <BitcoinIcon
          className={`${styles.icon} ${styles.iconPaymentFullBitcoinIcon} ${styles.PaymentSection_icon}`}
        />
        <QiwiIcon
          className={`${styles.icon} ${styles.iconPaymentFullQiwiIcon} ${styles.PaymentSection_icon}`}
        />
        <EthereumIcon
          className={`${styles.icon} ${styles.iconPaymentFullEthereumIcon} ${styles.PaymentSection_icon}`}
        />
        <TetherIcon
          className={`${styles.icon} ${styles.iconPaymentFullTetherIcon} ${styles.PaymentSection_icon}`}
        />
        <SkrillIcon
          className={`${styles.icon} ${styles.iconPaymentFullSkrillIcon} ${styles.PaymentSection_icon}`}
        />
        <PayerrIcon
          className={`${styles.icon} ${styles.iconPaymentFullSkrillIcon} ${styles.PaymentSection_icon}`}
        />
        <PiastrixIcon
          className={`${styles.icon} ${styles.iconPaymentFullPiastrixIcon} ${styles.PaymentSection_icon}`}
        />
        <FkWalletIcon
          className={`${styles.icon} ${styles.iconPaymentFullFkWalletIcon} ${styles.PaymentSection_icon}`}
        />
        <WebmoneyIcon
          className={`${styles.icon} ${styles.iconPaymentFullWebmoneyIcon} ${styles.PaymentSection_icon}`}
        />
        <MuchbetterIcon
          className={`${styles.icon} ${styles.iconPaymentFullMuchbetterIcon} ${styles.PaymentSection_icon}`}
        />
        <JbsIcon
          className={`${styles.icon} ${styles.iconPaymentFullMuchbetterIcon} ${styles.PaymentSection_icon}`}
        />
        <DiscoverIcon
          className={`${styles.icon} ${styles.iconPaymentFullDiscoverIcon} ${styles.PaymentSection_icon}`}
        />
        <InteracIcon
          className={`${styles.icon} ${styles.iconPaymentFullInteracIcon} ${styles.PaymentSection_icon}`}
        />
        <AstropayIcon
          className={`${styles.icon} ${styles.iconPaymentFullAstropayIcon} ${styles.PaymentSection_icon}`}
        />
      </div>

      <div
        className={`${styles.Footer_rowSeparator} ${styles.mobileHidden}`}
        aria-hidden
      />

      <div className={`${styles.TrustStrip} ${styles.mobileHidden}`}>
        <TrustBadgesRow />
      </div>

      <div className={styles.Footer_middleSeparator}></div>

      <div className={styles.LicenseSection_container}>
        <div className={styles.LicenseSection_legalBlock}>
          <span className={styles.LicenseSection_bold}>© 2024-2026 IMBA.BET</span>
          <p className={styles.LicenseSection_notice}>
            {t("footer.legalNotice")}{" "}
            <a
              href="https://www.gamblingtherapy.org/ru/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Gambling Therapy
            </a>
            .
          </p>
          <p className={styles.LicenseSection_aiBan}>
            <strong className={styles.LicenseSection_aiBanTitle}>
              {t("footer.aiBanTitle")}
            </strong>{" "}
            {t("footer.aiBanNotice")}
          </p>
          <p className={styles.LicenseSection_aiBan}>
            <strong className={styles.LicenseSection_aiBanTitle}>
              {t("footer.aiBanApiTitle")}
            </strong>{" "}
            {t("footer.aiBanApiNotice")}{" "}
            <Link href="/legal/ai-usage-policy">{t("footer.aiPolicyLink")}</Link>
          </p>
        </div>
        <div className={styles.LicenseSection_leftSection}>
          <span className={styles.Listings_ageLimit} aria-label={t("footer.ageOnlyAria")}>
            21+
          </span>
        </div>
      </div>
    </footer>
  );
};
