import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { WcBroadcastProvider } from "~/entities/wc-odds/lib/WcBroadcastContext";
import { WcLiveTrackerProvider } from "~/entities/wc-odds/lib/WcLiveTrackerContext";
import { WcBroadcastMobileOverlay } from "~/entities/wc-odds/ui/WcBroadcastMobileOverlay";
import { WcBroadcastSidebar } from "~/entities/wc-odds/ui/WcBroadcastSidebar";
import "~/shared/ui/styles/index.css";

import styles from "./Main.module.css";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GamesBettingProvider>
      <WcBroadcastProvider>
        <WcLiveTrackerProvider>
          <WcBroadcastMobileOverlay />
          <main className={styles.main}>
            {children}
            <WcBroadcastSidebar className={styles.coupon} />
          </main>
        </WcLiveTrackerProvider>
      </WcBroadcastProvider>
    </GamesBettingProvider>
  );
}
