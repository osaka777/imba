import { LogoWhiteIcon } from "@/shared/assets";
import { Telegram } from "@/shared/assets/icons";
import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

const NAV = [
    { label: "Преимущества", href: "#features" },
    { label: "Продукт", href: "#product" },
    { label: "FAQ", href: "#FAQ" },
    { label: "Контакты", href: "#contacts" },
];

export const Footer = () => {
    return (
        <footer className={styles.Footer}>
            <div className={styles.inner}>
                <div className={styles.top}>
                    <div className={styles.logo}>
                        <Image src={LogoWhiteIcon} alt="imba.bet" width={120} height={18} />
                    </div>
                    <nav className={styles.nav}>
                        {NAV.map(({ label, href }) => (
                            <Link key={href} href={href} className={styles.navLink}>
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className={styles.bottom}>
                    <div className={styles.socials}>
                        <a
                            className={styles.socialLink}
                            href="https://t.me/imbabetofficial"
                            rel="noopener noreferrer"
                            target="_blank"
                            aria-label="Telegram"
                        >
                            <Telegram />
                        </a>
                    </div>
                    <p className={styles.copyright}>
                        © {new Date().getFullYear()} imba.bet · Правила и условия
                    </p>
                </div>
            </div>
        </footer>
    );
};
