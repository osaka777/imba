"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const THEME_ATTR = "data-cybersport-theme";

export function CybersportThemeScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport") ?? false;

  useEffect(() => {
    if (isCybersport) {
      document.documentElement.setAttribute(THEME_ATTR, "true");
    } else {
      document.documentElement.removeAttribute(THEME_ATTR);
    }

    return () => {
      document.documentElement.removeAttribute(THEME_ATTR);
    };
  }, [isCybersport]);

  return children;
}
