"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const METRIKA_ID = 98703324;

function sendHit(url: string): boolean {
  if (typeof window.ym === "function") {
    window.ym(METRIKA_ID, "hit", url);
    return true;
  }
  return false;
}

function scheduleHit(url: string) {
  if (sendHit(url)) return () => {};

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (sendHit(url) || attempts >= 20) {
      window.clearInterval(timer);
    }
  }, 500);

  return () => window.clearInterval(timer);
}

export default function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = `${pathname}?${searchParams}`;
    return scheduleHit(url);
  }, [pathname, searchParams]);

  return null;
}
