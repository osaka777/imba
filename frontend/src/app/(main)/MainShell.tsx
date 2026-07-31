"use client";

import { usePathname } from "next/navigation";

import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { PartnerKickMobileBanner } from "~/entities/kick/ui/PartnerKickMobileBanner";
import { PartnerKickUrlBanner } from "~/entities/kick/ui/PartnerKickUrlBanner";
import { WcBroadcastProvider } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcLiveTrackerProvider } from "~/entities/wc-odds/lib/WcLiveTrackerContext";
import { WcBroadcastMobileOverlay } from "~/entities/wc-odds/ui/WcBroadcastMobileOverlay";
import { WcBroadcastSidebar } from "~/entities/wc-odds/ui/WcBroadcastSidebar";
import { cn } from "~/shared/lib";
import { Navigation } from "~/widgets/Navigation";

import styles from "./Main.module.css";
import { MainContentWithBanner } from "./MainContentWithBanner";

function hideCouponOnPath(pathname: null | string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/trader/") ||
    pathname.startsWith("/user/") ||
    pathname === "/trader" ||
    pathname === "/user"
  );
}

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideCoupon = hideCouponOnPath(pathname);

  return (
    <GamesBettingProvider>
      <WcBroadcastProvider>
        <WcLiveTrackerProvider>
          <WcBroadcastMobileOverlay />
          <PartnerKickUrlBanner />
          <PartnerKickMobileBanner />
          <main
            className={cn(styles.main, hideCoupon && styles.mainNoCoupon)}
          >
            <Navigation className={styles.nav} />
            <div className={styles.content}>
              <MainContentWithBanner>{children}</MainContentWithBanner>
            </div>
            {hideCoupon ? null : (
              <WcBroadcastSidebar className={styles.coupon} />
            )}
          </main>
        </WcLiveTrackerProvider>
      </WcBroadcastProvider>
    </GamesBettingProvider>
  );
}
