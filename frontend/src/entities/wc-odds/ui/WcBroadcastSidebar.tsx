"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { DeferredCouponSidebar } from "~/entities/wc-odds/ui/DeferredCouponSidebar";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import { cn } from "~/shared/lib";

import styles from "~/entities/wc-odds/ui/WcBroadcastSidebar.module.css";

type WcBroadcastSidebarProps = {
  className?: string;
};

const DESKTOP_MQ = "(min-width: 768px)";

export function WcBroadcastSidebar({ className }: WcBroadcastSidebarProps) {
  const broadcast = useWcBroadcast();
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showPlayer = Boolean(
    isDesktop
    && broadcast?.hasBroadcast
    && broadcast.eventRef
    && broadcast.visible,
  );

  return (
    <div className={cn(styles.sidebar, className, isCybersport && "CouponSidebar_cyber")}>
      {showPlayer && broadcast?.eventRef ? (
        <WcBroadcastPlayer
          eventRef={broadcast.eventRef}
          hasBroadcast
          meta={broadcast.meta}
          onClose={broadcast.close}
          showClose
          variant="sidebar"
        />
      ) : null}
      <DeferredCouponSidebar />
    </div>
  );
}
