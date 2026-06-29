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

const tabList: { Icon: ComponentType<{ className?: string }>; href: string; label: string }[] = [
  { Icon: HomeIcon, href: "/", label: "Главная" },
  { Icon: SoccerBallIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/live", label: "LIVE" },
  { Icon: PresentIcon, href: "#", label: "Free money" },
  { Icon: HistoryIcon, href: "/profile/betHistory", label: "История" },
];

const tabListNoAuth: { Icon: ComponentType<{ className?: string }>; href: string; label: string }[] = [
  { Icon: HomeIcon, href: "/", label: "Главная" },
  { Icon: SoccerBallIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/live", label: "LIVE" },
  { Icon: PresentIcon, href: "#", label: "Free money" },
];

export const Content = ({ isAuth }: { isAuth: boolean }) => {
  const path = usePathname();
  const pathName = path === "/" ? "/" : `/${path.split("/")[1]}`;
  const isCybersport = path?.startsWith("/cybersport");

  const tabs = isAuth ? tabList : tabListNoAuth;

  return (
    <nav className={cn(styles.Content, isCybersport && "MobileNav_cyber")}>
      {tabs.map((tab, index) => {
        const isCurrent = tab.href === pathName || tab.href === path;
        return (
          <Button
            className={`${styles.tab} ${isCurrent ? styles.item_current : ""} ${tabs.length === index + 1 ? styles.item_last : ""}`}
            elementType="link"
            href={tab.href}
            key={tab.label}
          >
            <tab.Icon className={styles.icon} />
            <p className={styles.link}>{tab.label}</p>
          </Button>
        );
      })}
    </nav>
  );
};
