"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./alerts.module.css";

type AlertItem = {
  id: string;
  type: "registration" | "ftd";
  createdAt: string;
  label: string;
};

type AlertsResponse = {
  found: boolean;
  alerts: AlertItem[];
};

const WIDGET_API =
  (process.env.NEXT_PUBLIC_MAIN_SITE || "https://imba.bet").replace(/\/$/, "");

const DISPLAY_MS = 5200;

export function StreamAlertsWidget({ tag }: { tag: string }) {
  const [visible, setVisible] = useState<AlertItem[]>([]);
  const lastIdRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const after = lastIdRef.current ? `?after=${encodeURIComponent(lastIdRef.current)}` : "";
        const res = await fetch(
          `${WIDGET_API}/api/kick/partners/widget/${encodeURIComponent(tag)}/alerts${after}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as AlertsResponse;
        if (!json.found || cancelled) return;

        const fresh = json.alerts.filter((item) => !seenRef.current.has(item.id));
        if (fresh.length === 0) return;

        for (const item of fresh) {
          seenRef.current.add(item.id);
          lastIdRef.current = item.id;
        }

        setVisible((prev) => [...prev, ...fresh].slice(-3));
      } catch {
        /* ignore */
      }
    };

    void poll();
    const timer = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tag]);

  useEffect(() => {
    if (visible.length === 0) return;

    const timers = visible.map((item) =>
      window.setTimeout(() => {
        setVisible((prev) => prev.filter((row) => row.id !== item.id));
      }, DISPLAY_MS),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [visible]);

  return (
    <div className={styles.root}>
      <div className={styles.stack}>
        {visible.map((item) => (
          <div
            key={item.id}
            className={[
              styles.toast,
              item.type === "ftd" ? styles.toastFtd : styles.toastReg,
            ].join(" ")}
          >
            <span className={styles.badge}>
              {item.type === "ftd" ? "FTD" : "REG"}
            </span>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.brand}>imba.bet</span>
          </div>
        ))}
      </div>
    </div>
  );
}
