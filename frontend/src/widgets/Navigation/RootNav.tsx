"use client";

import { usePathname } from "next/navigation";

import shellStyles from "~/app/SiteShell.module.css";

import { Navigation } from "./Navigation";

function shouldShowRootNav(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/profile")) return true;
  if (pathname.startsWith("/info")) return true;
  if (pathname.startsWith("/deposit")) return true;
  if (pathname.startsWith("/main")) return true;
  return false;
}

export const RootNav = () => {
  const pathname = usePathname();

  if (!shouldShowRootNav(pathname)) {
    return null;
  }

  return (
    <div className={shellStyles.navSlot}>
      <Navigation />
    </div>
  );
};
