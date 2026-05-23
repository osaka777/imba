import { LogoWhiteIcon } from "@/shared/assets";
import {
    InstagramIcon, Telegram,
    TelegramIcon,
} from "@/shared/assets/icons";
import { ScrollToTopButton } from "@/shared/UI/Button";
import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

export const Footer = () => {
    return (
        <footer className={styles.Footer}>
            <div className={styles.Footer_logoContainer}>
                <div className={styles.Footer_logoWrapper}>
                    <div className={`${styles.SvgLogo_svgLogoContainer} ${styles.Footer_logo}`}>
                        <Image src={LogoWhiteIcon} alt="" width={100} height={15} />
                    </div>
                </div>
                <div className={styles.Footer_LogoSeparator}></div>
            </div>
            <div className={styles.Footer_promotionSection}>
                <div className={styles.SocialList_root}>
                    <ul className={styles.SocialList_list}>
                        <li className={styles.SocialList_item}>
                            <a
                                className={`${styles.SocialList_link}`}
                                href="#"
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <Telegram />
                            </a>
                        </li>
                        <li className={styles.SocialList_item}>
                            <a
                                className={`${styles.SocialList_link}`}
                                href="#"
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <InstagramIcon />
                            </a>
                        </li>
                    </ul>
                    <div className={styles.links}>
                        <div className={styles.link}>Преимущества</div>
                        <div className={styles.link}>Продукт</div>
                        <div className={styles.link}>FAQ</div>
                        <div className={styles.link}>Контакты</div>
                    </div>
                </div>
                <div className={styles.link}>
                    © 2024 imba.bet <br />
                    Правила и условия
                </div>
            </div>
        </footer>
    );
};
