import Image from "next/image";
import Link from "next/link";

import { LogoWhiteIcon } from "~/shared/assets";
import { ImbaImage } from "~/shared/assets/images";

import {
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
  SkrillIcon,
  TelegramIcon,
  TetherIcon,
  UefaIcon,
  UfcIcon,
  VisaIcon,
  WebmoneyIcon,
  WtaIcon,
} from "~/shared/assets/icons";
import { ScrollToTopButton } from "~/shared/ui/Button";

import styles from "./Footer.module.css";

export const Footer = () => {
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
            <div className={styles.ContactSection_title}>Поддержка 24/7</div>
            <Link className={styles.ContactSection_subtitle} href="#support">
              Свяжитесь с нами, если у вас остались вопросы
            </Link>
          </div>
          <div
            className={`${styles.NavigationSection_root} ${styles.Footer_navigationSection}`}
          >
            <div
              className={`${styles.NavigationSection_block} ${styles.mobileHidden}`}
            >
              <p className={styles.NavigationSection_title}>
                Контакты поддержки
              </p>
              <div className={styles.NavigationSection_contacts}>
                <div className={styles.NavigationSection_contactsRow}>
                  <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      Техническая поддержка
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
                      Служба безопасности
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
                      Коммерческие предложения
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
                {/* <div className={styles.NavigationSection_contactsRow}>
                   <div
                    className={`${styles.NavigationSection_contactsCellName} ${styles.NavigationSection_contactsCell}`}
                  >
                    <span className={styles.NavigationSection_link}>
                      Партнерская программа
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
                </div> */}
              </div>
            </div>
            <div className={styles.NavigationSection_block}>
              <p className={styles.NavigationSection_title}>Информация</p>
              <div className={styles.NavigationInfo}>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/info"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Правила
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/guides">
                    Помощь
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link
                    className={styles.NavigationSection_link}
                    href="/info"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Контакты
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <Link className={styles.NavigationSection_link} href="/app">
                    Скачать приложение
                  </Link>
                </div>
                <div className={styles.NavigationSection_linksRow}>
                  <a
                    className={styles.NavigationSection_link}
                    href="https://partners.imba.bet"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Партнерская программа
                  </a>
                </div>
              </div>
            </div>
            <div className={styles.NavigationSection_block}>
              <p className={styles.NavigationSection_title}>Категории</p>
              <div className={styles.NavigationSection_listCategories}>
                <div className={styles.NavigationSection_listCategoriesColumn}>
                  <div className={styles.NavigationSection_contactsRow}>
                    <Link className={styles.NavigationSection_link} href="/live">
                      Live
                    </Link>
                  </div>
                  <div className={styles.NavigationSection_contactsRow}>
                    <Link
                      className={styles.NavigationSection_link}
                      href="/line"
                    >
                      Линия
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                href="https://www.instagram.com/"
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
      <div className={styles.Footer_middleSeparator}></div>
      <div className={styles.LicenseSection_container}>
        <div className={styles.LicenseSection_copyright}>
          <span className={styles.LicenseSection_bold}>
            © 2024-2026 IMBA.BET&nbsp;
          </span>
        </div>
        <div className={styles.LicenseSection_leftSection}>
          {/*<a href="https://vprognoze.ru/bookmakers/imba-bet/" target="_blank" style={{ position: "relative", bottom: "20px", right: "10px", padding: "40px" }}>*/}
          {/* <a href="https://vprognoze.ru/bookmakers/imba-bet/" target="_blank" style={{ position: "inherit", margin: "0px 0 0 0" }}>
            <Image
                className={styles.LicenseSection_image}
                alt="overlay-image"
                src="/banner_vp_transparent.png"
                width={200}
                height={72}
            />
          </a> */}

          <div
            className={`${styles.Listings_desktop} ${styles.Listings_mobile}`}
          >
            {/* <Image
              src={ImbaImage}
              alt="IMBA"
              className={`${styles.icon} ${styles.PaymentSection_icon}`}
              style={{ height: "25px", width: "auto" }}
            /> */}
            {/*<span className={styles.Listings_ageLimit}>18+ </span>*/}
          </div>
        </div>
      </div>
    </footer>
  );
};
