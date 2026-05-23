"use client";

import { usePathname } from "next/navigation";
import { ComponentType } from "react";

import {
  HistoryIcon,
  LiveIcon,
  LiveTvIcon,
  PresentIcon,
  SoccerBallIcon,
} from "~/shared/assets";
import { Button } from "~/shared/ui";

import styles from "./Content.module.css";

const tabList: { Icon: ComponentType<{ className?: string }>; href: string; label: string }[] = [
  { Icon: SoccerBallIcon, href: "/#", label: "Главная" },
  { Icon: LiveTvIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/", label: "LIVE" },
  { Icon: PresentIcon, href: "#", label: "Free money" },
  { Icon: HistoryIcon, href: "/profile/betHistory", label: "История" },
];

const tabListNoAuth: { Icon: ComponentType<{ className?: string }>; href: string; label: string }[] = [
  { Icon: SoccerBallIcon, href: "/#", label: "Главная" },
  { Icon: LiveTvIcon, href: "/line", label: "Линия" },
  { Icon: LiveIcon, href: "/", label: "LIVE" },
  { Icon: PresentIcon, href: "#", label: "Free money" },
];

export const Content = ({ isAuth }: { isAuth: boolean }) => {
  const path = usePathname();
  const pathName = path === "/" ? "/" : `/${path.split("/")[1]}`;

  const tabs = isAuth ? tabList : tabListNoAuth;

  return (
    <nav className={styles.Content}>
      {tabs.map((tab, index) => {
        const isCurrent = tab.href === pathName || tab.href === path;
        return (
          <Button
            className={`${styles.tab} ${isCurrent ? styles.item_current : ""} ${tabList.length === index + 1 ? styles.item_last : ""}`}
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
