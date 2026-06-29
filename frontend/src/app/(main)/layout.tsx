import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { WcBroadcastProvider } from "~/entities/wc-odds/lib/WcBroadcastContext";
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
        <main className={styles.main}>
          <Navigation className={styles.nav} />
          <div className={styles.content}>{children}</div>
          <WcBroadcastSidebar className={styles.coupon} />
        </main>
      </WcBroadcastProvider>
    </GamesBettingProvider>
  );
}
