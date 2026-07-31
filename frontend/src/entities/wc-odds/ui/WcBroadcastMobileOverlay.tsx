"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import styles from "~/entities/wc-odds/ui/WcBroadcastSidebar.module.css";
import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";
import { useLocale } from "~/shared/model/useLocale";

function sidebarHostsMatchPlayer(pathname: null | string): boolean {
  if (!pathname) return true;
  if (
    pathname.startsWith("/trader/")
    || pathname.startsWith("/user/")
    || pathname === "/trader"
    || pathname === "/user"
  ) {
    return false;
  }
  if (
    pathname === "/trading"
    || pathname === "/trading/"
    || pathname === "/casino/btc-updown"
    || pathname === "/casino/btc-updown/"
  ) {
    return false;
  }
  if (/^\/trading\/[a-z0-9-]+\/?$/i.test(pathname)) {
    return false;
  }
  return true;
}

/**
 * Persistent broadcast window: stays open across route changes until X is pressed.
 * Mobile: floating mini-player (does not block page navigation).
 * Desktop: only when the coupon sidebar is not hosting the match player.
 */
export function WcBroadcastMobileOverlay() {
  const { t } = useLocale();
  const broadcast = useWcBroadcast();
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showPlayer = Boolean(
    broadcast?.hasBroadcast && broadcast.eventRef && broadcast.visible,
  );
  const desktopNeedsFloat = isDesktop && !sidebarHostsMatchPlayer(pathname);
  const showHere = showPlayer && (!isDesktop || desktopNeedsFloat);

  if (!mounted || !showHere || !broadcast?.eventRef) {
    return null;
  }

  return createPortal(
    <div
      className={styles.persistentFloat}
      role="complementary"
      aria-label={t("wc.videoBroadcast")}
    >
      <div className={styles.persistentFloatInner}>
        <WcBroadcastPlayer
          compactModal
          eventRef={broadcast.eventRef}
          hasBroadcast
          meta={broadcast.meta}
          onClose={broadcast.close}
          showClose
          variant="sidebar"
        />
      </div>
    </div>,
    document.body,
  );
}
