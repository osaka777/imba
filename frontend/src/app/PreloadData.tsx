"use client";

import { useEffect } from "react";

import { preloadPopularPages } from "~/shared/lib/preload";

export function PreloadData() {
  useEffect(() => {
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    });

    const schedulePreload = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => void preloadPopularPages(), { timeout: 12000 });
      } else {
        setTimeout(() => void preloadPopularPages(), 8000);
      }
    };

    if (document.readyState === "complete") {
      schedulePreload();
    } else {
      window.addEventListener("load", schedulePreload, { once: true });
    }
  }, []);

  return null;
}
