"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "~/shared/lib";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./List.module.css";

const tabList: {
  href: string;
  labelKey: MessageKey;
  showNewBadge?: boolean;
  newBadgeTone?: "violet" | "red";
}[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/live", labelKey: "nav.live" },
  { href: "/line", labelKey: "nav.line" },
  {
    href: "/cybersport",
    labelKey: "nav.cybersport",
    showNewBadge: true,
    newBadgeTone: "violet",
  },
  {
    href: "/markets",
    labelKey: "nav.markets",
    showNewBadge: true,
    newBadgeTone: "red",
  },
  { href: "/results", labelKey: "nav.results" },
];

const moreLinks: { href: string; labelKey: MessageKey }[] = [
  { href: "/trading", labelKey: "nav.btc" },
  { href: "/trading/race", labelKey: "nav.imbaGames" },
];

function isNavLinkActive(path: string | null, href: string) {
  if (!path) return false;
  if (href === "/") return path === "/";
  if (href === "/trading") {
    return (
      path === "/trading" ||
      (path.startsWith("/trading/") && !path.startsWith("/trading/race"))
    );
  }
  return path === href || path.startsWith(`${href}/`);
}

type MenuPos = { top: number; left: number };

export const List = () => {
  const path = usePathname();
  const { t } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const moreRef = useRef<HTMLLIElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const moreActive = moreLinks.some((link) =>
    isNavLinkActive(path, link.href),
  );

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openMore = () => {
    clearCloseTimer();
    setMoreOpen(true);
  };

  const scheduleCloseMore = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setMoreOpen(false);
      closeTimer.current = null;
    }, 120);
  };

  const updateMenuPos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 7,
      left: rect.left,
    });
  };

  useEffect(() => {
    setPortalReady(true);
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    clearCloseTimer();
  }, [path]);

  useLayoutEffect(() => {
    if (!moreOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const menu =
    moreOpen && portalReady && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.moreMenuPortal}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onMouseEnter={openMore}
            onMouseLeave={scheduleCloseMore}
          >
            {moreLinks.map((link) => {
              const active = isNavLinkActive(path, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  className={cn(
                    styles.moreLink,
                    active && styles.moreLinkActive,
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <ul className={styles.List}>
      {tabList.map((tab) => {
        const label = t(tab.labelKey);
        const isCurrent = isNavLinkActive(path, tab.href);
        return (
          <li
            className={cn(styles.item, isCurrent && styles.item_current)}
            key={tab.href}
          >
            <Link
              className={cn(
                styles.tabLink,
                tab.showNewBadge && styles.tabLink_withBadge,
              )}
              href={tab.href}
            >
              <p className={styles.link}>{label}</p>
              {tab.showNewBadge && (
                <span
                  aria-hidden
                  className={cn(
                    styles.newBadge,
                    tab.newBadgeTone === "red"
                      ? styles.newBadge_red
                      : styles.newBadge_violet,
                  )}
                >
                  NEW
                </span>
              )}
            </Link>
            {isCurrent && <div className={styles.underline} />}
          </li>
        );
      })}

      <li
        ref={moreRef}
        className={cn(
          styles.item,
          styles.moreItem,
          moreOpen && styles.moreItemOpen,
        )}
        onMouseEnter={openMore}
        onMouseLeave={scheduleCloseMore}
      >
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            styles.moreTrigger,
            (moreOpen || moreActive) && styles.moreTriggerOpen,
          )}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onFocus={openMore}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className={styles.moreLabel}>{t("nav.more")}</span>
          <svg
            className={styles.moreDots}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 128 512"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M64 208c26.5 0 48 21.5 48 48s-21.5 48-48 48-48-21.5-48-48 21.5-48 48-48zM16 104c0 26.5 21.5 48 48 48s48-21.5 48-48-21.5-48-48-48-48 21.5-48 48zm0 304c0 26.5 21.5 48 48 48s48-21.5 48-48-21.5-48-48-48-48 21.5-48 48z"
            />
          </svg>
        </button>
        {menu}
      </li>
    </ul>
  );
};
