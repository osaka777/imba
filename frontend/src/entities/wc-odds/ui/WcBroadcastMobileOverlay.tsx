"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";

import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";

import styles from "~/entities/wc-odds/ui/WcBroadcastSidebar.module.css";

/** Full-screen mobile/tablet player — mounted at provider level (not inside coupon column). */
export function WcBroadcastMobileOverlay() {
  const broadcast = useWcBroadcast();
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

  useEffect(() => {
    if (!mounted || isDesktop || !showPlayer) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, isDesktop, showPlayer]);

  if (!mounted || isDesktop || !showPlayer || !broadcast?.eventRef) {
    return null;
  }

  return createPortal(
    <div
      className={styles.mobileOverlay}
      onClick={broadcast.close}
      role="presentation"
    >
      <div
        className={styles.mobileOverlayInner}
        onClick={(e) => e.stopPropagation()}
      >
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
