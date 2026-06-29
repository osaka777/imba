"use client";

import { useEffect, useState } from "react";

import { LazyCouponSidebar } from "~/shared/lib/lazyModals";

const MOBILE_MQ = "(max-width: 767px)";

/** На мобилке купон — отдельный чанк после idle, на десктопе сразу. */
export function DeferredCouponSidebar({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    if (!mq.matches) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const activate = () => {
      if (!cancelled) setReady(true);
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(activate, { timeout: 4000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = window.setTimeout(activate, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;
  return <LazyCouponSidebar className={className} />;
}
