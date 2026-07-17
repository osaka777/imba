"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { usePartnerKickAttribution } from "~/entities/kick/lib/usePartnerKickAttribution";
import { PartnerKickPlayer } from "~/entities/kick/ui/PartnerKickPlayer";
import { DeferredCouponSidebar } from "~/entities/wc-odds/ui/DeferredCouponSidebar";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import { cn } from "~/shared/lib";
import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";

import styles from "~/entities/wc-odds/ui/WcBroadcastSidebar.module.css";

type WcBroadcastSidebarProps = {
  className?: string;
};

export function WcBroadcastSidebar({ className }: WcBroadcastSidebarProps) {
  const broadcast = useWcBroadcast();
  const { partner: partnerKick } = usePartnerKickAttribution(true);
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport");
  const isCyberGamePage = pathname?.startsWith("/cybersport/game/");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showPartnerPlayer = Boolean(isDesktop && partnerKick?.isLive && partnerKick.channelSlug);
  const showPlayer = Boolean(
    isDesktop
    && !isCyberGamePage
    && !showPartnerPlayer
    && broadcast?.hasBroadcast
    && broadcast.eventRef
    && broadcast.visible,
  );

  return (
    <div className={cn(styles.sidebar, className, isCybersport && "CouponSidebar_cyber")}>
      {showPartnerPlayer && partnerKick ? (
        <PartnerKickPlayer partner={partnerKick} />
      ) : null}
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
