"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { TradingPublicPnl } from "~/entities/btc-updown/ui/TradingPublicPnl";
import { TradingSideRail } from "~/entities/btc-updown/ui/TradingSideRail";
import { usePartnerKickAttribution } from "~/entities/kick/lib/usePartnerKickAttribution";
import { PartnerKickPlayer } from "~/entities/kick/ui/PartnerKickPlayer";
import { useWcBroadcast } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { useWcLiveTrackerContext } from "~/entities/wc-odds/lib/WcLiveTrackerContext";
import { isBroadcastAuthed } from "~/entities/wc-odds/lib/wcBroadcastAuth";
import { DeferredCouponSidebar } from "~/entities/wc-odds/ui/DeferredCouponSidebar";
import { WcBroadcastPlayer } from "~/entities/wc-odds/ui/WcBroadcastPlayer";
import styles from "~/entities/wc-odds/ui/WcBroadcastSidebar.module.css";
import { WcLiveTrackerPanel } from "~/entities/wc-odds/ui/WcLiveTrackerPanel";
import { cn } from "~/shared/lib";
import { MQ_DESKTOP } from "~/shared/lib/layoutBreakpoints";

type WcBroadcastSidebarProps = {
  className?: string;
};

function isTradingHubPath(pathname: null | string): boolean {
  return (
    pathname === "/trading" ||
    pathname === "/trading/" ||
    pathname === "/casino/btc-updown" ||
    pathname === "/casino/btc-updown/"
  );
}

function isTradingAssetPath(pathname: null | string): boolean {
  if (!pathname) return false;
  return /^\/trading\/[a-z0-9-]+\/?$/i.test(pathname);
}

function isProfilePath(pathname: null | string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/trader/") ||
    pathname.startsWith("/user/") ||
    pathname === "/trader" ||
    pathname === "/user"
  );
}

/**
 * Desktop coupon rail media:
 * 1) Our Kick partner stream (if attributed + live) — exclusive.
 * 2) Else match 1win/video when user opened broadcast.
 * 3) Else Live Tracker when available.
 * Never stack two iframes (video + tracker) — that blanked both.
 */
export function WcBroadcastSidebar({ className }: WcBroadcastSidebarProps) {
  const broadcast = useWcBroadcast();
  const tracker = useWcLiveTrackerContext();
  const { partner: partnerKick } = usePartnerKickAttribution(true);
  const pathname = usePathname();
  const isTradingHub = isTradingHubPath(pathname);
  const isTradingAsset = isTradingAssetPath(pathname);
  const isProfile = isProfilePath(pathname);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const showPartnerPlayer = Boolean(
    isDesktop && partnerKick?.isLive && partnerKick.channelSlug,
  );
  // Video occupies the rail only when the user can actually play (/play is authed).
  // Auth-gate placeholder used to replace Live Tracker and looked like "tracker missing".
  const showMatchPlayer = Boolean(
    isDesktop &&
      !showPartnerPlayer &&
      broadcast?.hasBroadcast &&
      broadcast.eventRef &&
      broadcast.visible &&
      isBroadcastAuthed(),
  );
  // Tracker when neither partner nor real match video occupies the media slot.
  const showTracker = Boolean(
    isDesktop && tracker?.trackerUrl && !showPartnerPlayer && !showMatchPlayer,
  );

  if (isProfile) {
    return null;
  }

  if (isTradingHub) {
    return (
      <div className={cn(styles.sidebar, className, styles.tradingHubCoupon)}>
        {isDesktop ? (
          <>
            <TradingSideRail variant="coupon" />
            <TradingPublicPnl compact />
          </>
        ) : null}
      </div>
    );
  }

  /* Game pages keep the bet ticket inside BtcUpdownGame (not Main coupon). */
  if (isTradingAsset) {
    return null;
  }

  return (
    <div className={cn(styles.sidebar, className)}>
      {showPartnerPlayer && partnerKick ? (
        <PartnerKickPlayer partner={partnerKick} />
      ) : null}
      {showMatchPlayer && broadcast?.eventRef ? (
        <WcBroadcastPlayer
          eventRef={broadcast.eventRef}
          hasBroadcast
          meta={broadcast.meta}
          onClose={broadcast.close}
          showClose
          variant="sidebar"
        />
      ) : null}
      {showTracker && tracker?.trackerUrl ? (
        <WcLiveTrackerPanel meta={tracker.meta} url={tracker.trackerUrl} variant="sidebar" />
      ) : null}
      <DeferredCouponSidebar />
    </div>
  );
}
