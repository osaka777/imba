import { GamesBettingProvider } from "~/app/providers/GamesBetting.provider";
import { Coupon } from "~/entities/bet";
import "~/shared/ui/styles/index.css";
import styles from "./Main.module.css";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GamesBettingProvider>
      <main className={styles.main}>
        {children}
        <Coupon className={styles.coupon} />
      </main>
    </GamesBettingProvider>
  );
}
