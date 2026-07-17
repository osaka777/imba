export type SupportSiteAction = "deposit" | "withdraw" | "voucher";

const DESKTOP_MEDIA = "(min-width: 769px)";

export function isDesktopSupportActions() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DESKTOP_MEDIA).matches;
}

export function resolveSupportSiteAction(label: string, href: string): SupportSiteAction | null {
  const normLabel = label.trim().toLowerCase();
  if (normLabel.includes("пополн")) return "deposit";
  if (normLabel.includes("вывод")) return "withdraw";
  if (normLabel.includes("бонус")) return "voucher";

  try {
    const url = new URL(href, "https://imba.bet");
    const path = url.pathname.toLowerCase();
    if (path.includes("/deposit") || path.includes("/wallets")) return "deposit";
    if (path.includes("/promocode")) return "voucher";
    if (path.includes("/financehistory")) return "withdraw";
  } catch {
    /* ignore */
  }
  return null;
}

export function dispatchSupportSiteAction(action: SupportSiteAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("imba:support-site-action", { detail: { action } }),
  );
}

export function mobileRouteForSupportAction(action: SupportSiteAction): string {
  if (action === "deposit") return "/profile/wallets";
  if (action === "withdraw") return "/profile";
  return "/profile/promocodes";
}

export function tryHandleSupportLinkClick(
  event: { preventDefault: () => void },
  href: string,
  label: string,
  options?: { isAuth?: boolean; onNeedAuth?: () => void },
): boolean {
  const action = resolveSupportSiteAction(label, href);
  if (!action) return false;

  if (!options?.isAuth) {
    event.preventDefault();
    options?.onNeedAuth?.();
    return true;
  }

  if (isDesktopSupportActions()) {
    event.preventDefault();
    dispatchSupportSiteAction(action);
    return true;
  }

  return false;
}
