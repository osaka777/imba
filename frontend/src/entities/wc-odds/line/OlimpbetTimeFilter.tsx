"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "~/shared/lib";

import {
  WC_LINE_TIME_OPTIONS,
  type WcLineHoursFilter,
} from "~/entities/wc-odds/line/wcLineTimeFilter";

import styles from "~/entities/wc-odds/line/OlimpbetTimeFilter.module.css";

type OlimpbetTimeFilterProps = {
  value: WcLineHoursFilter;
  counts: Record<string, number>;
  onChange: (value: WcLineHoursFilter) => void;
  onSelectAll: () => void;
  className?: string;
};

function isOptionDisabled(
  optionId: WcLineHoursFilter,
  activeId: WcLineHoursFilter,
  counts: Record<string, number>,
): boolean {
  if (optionId === activeId) return false;
  if (optionId === "all") return false;
  return (counts[optionId] ?? 0) === 0;
}

/** Мобильный фильтр — один выпадающий список «Все время ▾» */
export function OlimpbetTimeFilter({
  value,
  counts,
  onChange,
  onSelectAll,
  className,
}: OlimpbetTimeFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    WC_LINE_TIME_OPTIONS.find((option) => option.id === value)?.label ?? "Все время";

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const selectOption = (optionId: WcLineHoursFilter) => {
    if (optionId === "all") {
      onSelectAll();
    } else {
      onChange(optionId);
    }
    setOpen(false);
  };

  return (
    <div className={cn(styles.root, className)} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{currentLabel}</span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {WC_LINE_TIME_OPTIONS.map((option) => {
            const count = counts[option.id] ?? 0;
            const active = option.id === value;
            const disabled = isOptionDisabled(option.id, value, counts);
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  styles.item,
                  active && styles.item_active,
                  disabled && styles.item_disabled,
                )}
                disabled={disabled}
                onClick={() => selectOption(option.id)}
              >
                <span>{option.label}</span>
                <span className={styles.count}>{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
