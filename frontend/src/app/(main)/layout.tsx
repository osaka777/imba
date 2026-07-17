import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { MainContentWithBanner } from "./MainContentWithBanner";
import { WcBroadcastProvider } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { PartnerKickMobileBanner } from "~/entities/kick/ui/PartnerKickMobileBanner";
import { PartnerKickUrlBanner } from "~/entities/kick/ui/PartnerKickUrlBanner";
import { WcBroadcastMobileOverlay } from "~/entities/wc-odds/ui/WcBroadcastMobileOverlay";
import { WcBroadcastSidebar } from "~/entities/wc-odds/ui/WcBroadcastSidebar";
import { Navigation } from "~/widgets/Navigation";
import styles from "./Main.module.css";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GamesBettingProvider>
      <WcBroadcastProvider>
        <WcBroadcastMobileOverlay />
        <PartnerKickUrlBanner />
        <PartnerKickMobileBanner />
        <main className={styles.main}>
          <Navigation className={styles.nav} />
          <div className={styles.content}>
            <MainContentWithBanner>{children}</MainContentWithBanner>
          </div>
          <WcBroadcastSidebar className={styles.coupon} />
        </main>
      </WcBroadcastProvider>
    </GamesBettingProvider>
  );
}
