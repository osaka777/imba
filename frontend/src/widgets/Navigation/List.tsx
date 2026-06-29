"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/shared/lib";

import styles from "./List.module.css";

export const tabList: { href: string; label: string; showNewBadge?: boolean }[] = [
  { href: "/", label: "Главная" },
  { href: "/live", label: "Лайв" },
  { href: "/line", label: "Линия" },
];

export const List = () => {
  const path = usePathname();
  const pathName = path === "/" ? "/" : path?.split("/")[1];

  return (
    <ul className={styles.List}>
      {tabList.map((tab) => {
        const isCurrent = tab.href === `/${pathName === "/" ? "" : pathName}`;
        return (
          <li
            className={cn(styles.item, isCurrent && styles.item_current)}
            key={tab.label}
          >
            <Link
              className={cn(styles.tabLink, tab.showNewBadge && styles.tabLink_withBadge)}
              href={tab.href}
            >
              <p className={styles.link}>{tab.label}</p>
              {tab.showNewBadge && (
                <span aria-hidden className={styles.newBadge}>
                  NEW
                </span>
              )}
            </Link>
            {isCurrent && <div className={styles.underline} />}
          </li>
        );
      })}
    </ul>
  );
};
