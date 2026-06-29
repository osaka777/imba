"use client";

import { useEffect } from "react";

const THEME_ATTR = "data-cybersport-theme";

export function CybersportThemeScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTR, "true");
    return () => {
      document.documentElement.removeAttribute(THEME_ATTR);
    };
  }, []);

  return children;
}
