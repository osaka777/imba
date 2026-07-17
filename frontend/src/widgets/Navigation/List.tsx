"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/shared/lib";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./List.module.css";

const tabList: {
  href: string;
  labelKey: MessageKey;
  showNewBadge?: boolean;
}[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/live", labelKey: "nav.live" },
  { href: "/line", labelKey: "nav.line" },
  { href: "/results", labelKey: "nav.results" },
  { href: "/cybersport", labelKey: "nav.cybersport", showNewBadge: true },
];

export const List = () => {
  const path = usePathname();
  const { t } = useLocale();

  return (
    <ul className={styles.List}>
      {tabList.map((tab) => {
        const label = t(tab.labelKey);
        const isCurrent =
          tab.href === "/"
            ? path === "/"
            : Boolean(path === tab.href || path?.startsWith(`${tab.href}/`));
        return (
          <li
            className={cn(styles.item, isCurrent && styles.item_current)}
            key={tab.href}
          >
            <Link
              className={cn(styles.tabLink, tab.showNewBadge && styles.tabLink_withBadge)}
              href={tab.href}
            >
              <p className={styles.link}>{label}</p>
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
