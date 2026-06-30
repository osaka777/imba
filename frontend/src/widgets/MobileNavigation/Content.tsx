"use client";

import { usePathname } from "next/navigation";
import { ComponentType } from "react";

import { cn } from "~/shared/lib";

import {
  HistoryIcon,
  HomeIcon,
  LiveIcon,
  PresentIcon,
  SoccerBallIcon,
} from "~/shared/assets";
import { Button } from "~/shared/ui";

import styles from "./Content.module.css";

const tabList: { Icon: ComponentType<{ className?: string }>; href: string; label: string; live?: boolean }[] = [
  { Icon: HomeIcon, href: "/", label: "Главная" },
  { Icon: SoccerBallIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/live", label: "LIVE", live: true },
  { Icon: PresentIcon, href: "#", label: "Free money" },
  { Icon: HistoryIcon, href: "/profile/betHistory", label: "История" },
];

const tabListNoAuth: { Icon: ComponentType<{ className?: string }>; href: string; label: string; live?: boolean }[] = [
  { Icon: HomeIcon, href: "/", label: "Главная" },
  { Icon: SoccerBallIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/live", label: "LIVE", live: true },
  { Icon: PresentIcon, href: "#", label: "Free money" },
];

export const Content = ({ isAuth }: { isAuth: boolean }) => {
  const path = usePathname();
  const pathName = path === "/" ? "/" : `/${path.split("/")[1]}`;
  const isCybersport = path?.startsWith("/cybersport");

  const tabs = isAuth ? tabList : tabListNoAuth;

  return (
    <nav className={cn(styles.Content, isCybersport && "MobileNav_cyber")}>
      {tabs.map((tab) => {
        const isCurrent = tab.href === pathName || tab.href === path;
        return (
          <Button
            className={cn(
              styles.tab,
              isCurrent && styles.item_current,
              tab.live && styles.tab_live,
            )}
            elementType="link"
            href={tab.href}
            key={tab.label}
          >
            <span className={styles.iconWrap}>
              <tab.Icon className={styles.icon} />
              {tab.live && !isCurrent ? (
                <span className={styles.liveDot} aria-hidden />
              ) : null}
            </span>
            <span className={styles.link}>{tab.label}</span>
          </Button>
        );
      })}
    </nav>
  );
};
