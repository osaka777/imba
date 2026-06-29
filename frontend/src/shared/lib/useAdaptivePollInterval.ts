"use client";

import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 767px)";

/** Меньше polling на мобилке и в фоне — без отключения обновлений. */
export function useAdaptivePollInterval(activeMs = 5000): number {
  const [intervalMs, setIntervalMs] = useState(activeMs);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);

    const sync = () => {
      if (document.hidden) {
        setIntervalMs(30000);
        return;
      }
      setIntervalMs(mq.matches ? 12000 : activeMs);
    };

    sync();
    mq.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [activeMs]);

  return intervalMs;
}
