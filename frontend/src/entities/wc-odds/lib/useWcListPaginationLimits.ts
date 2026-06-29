"use client";

import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 767px)";

type WcListPaginationLimits = {
  initialLimit: number;
  pageSize: number;
  isMobile: boolean;
};

function readLimits(
  desktopInitial: number,
  mobileInitial: number,
  pageSize: number,
): WcListPaginationLimits {
  const isMobile =
    typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
  return {
    initialLimit: isMobile ? mobileInitial : desktopInitial,
    pageSize,
    isMobile,
  };
}

/** Responsive page sizes for /live and /line Olimpbet lists. */
export function useWcListPaginationLimits(
  desktopInitial: number,
  mobileInitial: number,
  pageSize: number,
): WcListPaginationLimits {
  const [limits, setLimits] = useState(() =>
    readLimits(desktopInitial, mobileInitial, pageSize),
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => {
      setLimits(readLimits(desktopInitial, mobileInitial, pageSize));
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [desktopInitial, mobileInitial, pageSize]);

  return limits;
}
