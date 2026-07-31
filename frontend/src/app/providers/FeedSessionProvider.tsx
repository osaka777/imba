"use client";

import { ReactNode, useEffect, useState } from "react";

import { detectBrowserAutomation } from "~/shared/lib/automationDetection";
import { ensureFeedSession } from "~/entities/wc-odds/lib/feedSession";

/**
 * Mints a short-lived feed cookie before odds HTTP/WS start.
 * Skips work when automation is already blocked by AutomationGate.
 */
export function FeedSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (detectBrowserAutomation()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        await ensureFeedSession();
      } catch {
        // Feed calls will 403; UI shows empty/error states without crashing.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    const refresh = window.setInterval(() => {
      if (detectBrowserAutomation()) return;
      void ensureFeedSession({ force: true }).catch(() => {});
    }, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  // Brief hold so the first feed fetches include the session cookie.
  if (!ready) {
    return (
      <div
        aria-hidden
        style={{
          minHeight: "40vh",
          background: "var(--blue-00)",
        }}
      />
    );
  }

  return <>{children}</>;
}
