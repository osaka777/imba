"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./AnimatedPrice.module.css";

type Props = {
  value: number | null | undefined;
  className?: string;
  prefix?: string;
};

export function AnimatedPrice({ value, className, prefix = "$" }: Props) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const p = prev.current;
    if (p != null && p !== value) {
      setFlash(value > p ? "up" : "down");
      setBump(true);
      const t1 = window.setTimeout(() => setFlash(null), 520);
      const t2 = window.setTimeout(() => setBump(false), 280);
      prev.current = value;
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    prev.current = value;
  }, [value]);

  const text =
    value == null || !Number.isFinite(value)
      ? "—"
      : `${prefix}${value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <span
      className={[
        styles.price,
        className,
        flash === "up" ? styles.flashUp : "",
        flash === "down" ? styles.flashDown : "",
        bump ? styles.bump : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {text}
    </span>
  );
}
