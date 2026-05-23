"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./List.module.css";

export const tabList: { href: string; label: string }[] = [
    { href: "#features", label: "Преимущества" },
    { href: "#product", label: "Продукт" },
    { href: "#FAQ", label: "FAQ" },
    { href: "#contacts", label: "Контакты" },
];

type ListProps = {
    linksOnClick?: () => void;
};

export const List: React.FC<ListProps> = ({ linksOnClick }) => {
    const path = usePathname();
    const pathName = path === "/" ? "/" : path.split("/")[1];

    return (
        <ul className={styles.List}>
            {tabList.map((tab) => {
                const isCurrent = tab.href === pathName;
                return (
                    <li className={`${styles.item} ${isCurrent ? styles.item_current : ""}`} key={tab.label}>
                        <Link onClick={linksOnClick} href={tab.href}>
                            <p className={styles.link}>{tab.label}</p>
                        </Link>
                        {isCurrent ? <div className={styles.underline}></div> : null}
                    </li>
                );
            })}
        </ul>
    );
};
