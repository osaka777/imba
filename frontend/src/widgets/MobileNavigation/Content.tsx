"use client";

import { usePathname } from "next/navigation";
import { ComponentType } from "react";

import { cn } from "~/shared/lib";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import {
  CSIcon,
  HistoryIcon,
  HomeIcon,
  LiveIcon,
  PresentIcon,
  SoccerBallIcon,
} from "~/shared/assets";
import { Button } from "~/shared/ui";

import styles from "./Content.module.css";

const tabList: {
  Icon: ComponentType<{ className?: string }>;
  href: string;
  labelKey: MessageKey;
  live?: boolean;
  showNewBadge?: boolean;
}[] = [
  { Icon: HomeIcon, href: "/", labelKey: "nav.home" },
  { Icon: SoccerBallIcon, href: "/line", labelKey: "nav.line" },
  { Icon: LiveIcon, href: "/live", labelKey: "nav.live", live: true },
  { Icon: PresentIcon, href: "/results", labelKey: "nav.results" },
  { Icon: CSIcon, href: "/cybersport", labelKey: "nav.cyberShort", showNewBadge: true },
  { Icon: HistoryIcon, href: "/profile/betHistory", labelKey: "nav.history" },
];

const tabListNoAuth: {
  Icon: ComponentType<{ className?: string }>;
  href: string;
  labelKey: MessageKey;
  live?: boolean;
  showNewBadge?: boolean;
}[] = [
  { Icon: HomeIcon, href: "/", labelKey: "nav.home" },
  { Icon: SoccerBallIcon, href: "/line", labelKey: "nav.line" },
  { Icon: LiveIcon, href: "/live", labelKey: "nav.live", live: true },
  { Icon: PresentIcon, href: "/results", labelKey: "nav.results" },
  { Icon: CSIcon, href: "/cybersport", labelKey: "nav.cyberShort", showNewBadge: true },
];

export const Content = ({ isAuth }: { isAuth: boolean }) => {
  const path = usePathname();
  const pathName = path === "/" ? "/" : `/${path.split("/")[1]}`;
  const isCybersport = path?.startsWith("/cybersport");
  const { t } = useLocale();

  const tabs = isAuth ? tabList : tabListNoAuth;

  return (
    <nav className={cn(styles.Content, isCybersport && "MobileNav_cyber")}>
      {tabs.map((tab) => {
        const label = t(tab.labelKey);
        const isCurrent = tab.href === pathName || tab.href === path;
        return (
          <Button
            className={cn(
              styles.tab,
              isCurrent && styles.item_current,
              tab.live && styles.tab_live,
              tab.showNewBadge && styles.tab_withBadge,
            )}
            elementType="link"
            href={tab.href}
            key={tab.href}
          >
            <span className={styles.iconWrap}>
              <tab.Icon className={styles.icon} />
              {tab.live && !isCurrent ? (
                <span className={styles.liveDot} aria-hidden />
              ) : null}
              {tab.showNewBadge && !isCurrent ? (
                <span aria-hidden className={styles.newBadge}>
                  NEW
                </span>
              ) : null}
            </span>
            <span className={styles.link}>{label}</span>
          </Button>
        );
      })}
    </nav>
  );
};
