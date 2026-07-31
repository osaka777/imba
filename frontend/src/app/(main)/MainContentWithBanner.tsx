"use client";

import { usePathname } from "next/navigation";

import { WelcomeBonusStickyBanner } from "~/entities/game/ui/LuckyDrive/WelcomeBonusStickyBanner";

export function MainContentWithBanner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideWelcomeBonus =
    pathname?.startsWith("/cybersport") ||
    pathname?.startsWith("/trading") ||
    pathname?.startsWith("/markets") ||
    pathname?.startsWith("/casino/btc-updown");

  return (
    <>
      {!hideWelcomeBonus ? <WelcomeBonusStickyBanner /> : null}
      {children}
    </>
  );
}
