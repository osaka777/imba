"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SettingsIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import type { OddsAcceptMode } from "../../lib/oddsAcceptMode";
import styles from "./CouponOddsSettings.module.css";

type CouponOddsSettingsProps = {
  mode: OddsAcceptMode;
  onChange: (mode: OddsAcceptMode) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const OPTIONS: Array<{
  mode: OddsAcceptMode;
  labelKey:
    | "coupon.acceptOddsNever"
    | "coupon.acceptOddsIncrease"
    | "coupon.acceptOddsAlways";
}> = [
  { mode: "never", labelKey: "coupon.acceptOddsNever" },
  { mode: "increase", labelKey: "coupon.acceptOddsIncrease" },
  { mode: "always", labelKey: "coupon.acceptOddsAlways" },
];

export function CouponOddsSettings({
  mode,
  onChange,
  open,
  onOpenChange,
}: CouponOddsSettingsProps) {
  const { t } = useLocale();
  const popoverRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState({ left: 8, top: 8, width: 220 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = wrapRef.current?.getBoundingClientRect();
      if (!trigger) return;

      const edge = window.innerWidth <= 480 ? 8 : 12;
      const preferred =
        window.innerWidth <= 480 ? 200 : window.innerWidth <= 768 ? 210 : 220;
      const width = Math.min(preferred, window.innerWidth - edge * 2);
      const height = popoverRef.current?.offsetHeight ?? 180;
      const left = Math.min(
        Math.max(edge, trigger.right - width),
        window.innerWidth - width - edge,
      );
      // Prefer above the gear; if not enough room, drop just below it.
      const above = trigger.top - height - 6;
      const below = trigger.bottom + 6;
      const top =
        above >= edge
          ? above
          : Math.min(below, Math.max(edge, window.innerHeight - height - edge));
      setPosition({ left, top, width });
    };

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !wrapRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, onOpenChange]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("coupon.settingsTitle")}
        className={styles.trigger}
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <SettingsIcon className={styles.triggerIcon} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-labelledby={titleId}
              className={styles.popover}
              ref={popoverRef}
              role="dialog"
              style={position}
            >
              <p className={styles.title} id={titleId}>
                {t("coupon.settingsTitle")}
              </p>
              <p className={styles.sectionLabel}>
                {t("coupon.acceptOddsSection")}
              </p>
              <div className={styles.options} role="radiogroup">
                {OPTIONS.map(({ mode: option, labelKey }) => {
                  const active = mode === option;
                  return (
                    <button
                      aria-checked={active}
                      className={cn(
                        styles.option,
                        active && styles.optionActive,
                      )}
                      key={option}
                      onClick={() => {
                        onChange(option);
                        onOpenChange(false);
                      }}
                      role="radio"
                      type="button"
                    >
                      <span aria-hidden className={styles.radio}>
                        <span className={styles.radioDot} />
                      </span>
                      <span className={styles.optionLabel}>{t(labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
