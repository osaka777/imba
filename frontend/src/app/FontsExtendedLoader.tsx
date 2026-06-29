"use client";

import { useEffect } from "react";

/** Подгружает редкие начертания SF Pro после первого рендера. */
export function FontsExtendedLoader() {
  useEffect(() => {
    void import("~/shared/ui/styles/fonts-extended.css");
  }, []);

  return null;
}
