"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Footer = dynamic(
  () => import("~/widgets/Footer").then((m) => m.Footer),
  { ssr: false, loading: () => <div style={{ minHeight: 48 }} aria-hidden /> },
);

/** Футер подгружается при приближении к viewport — не блокирует первый экран. */
export function FooterDeferred() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node) return;

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={anchorRef}>
      {visible ? <Footer /> : <div style={{ minHeight: 64 }} aria-hidden />}
    </div>
  );
}
