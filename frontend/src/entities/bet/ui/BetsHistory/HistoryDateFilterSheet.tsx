"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./HistoryDateFilterSheet.module.css";

export type HistoryDateFilter =
  | { kind: "all" }
  | { kind: "hours"; hours: number }
  | { kind: "day"; ymd: string };

const HOUR_PRESETS = [24, 12, 11, 10] as const;

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

type Cell = {
  date: Date;
  ymd: string;
  inMonth: boolean;
  isFuture: boolean;
};

function buildCalendarCells(year: number, month: number): Cell[] {
  const first = startOfMonth(year, month);
  // Monday-first: JS Sunday=0 → shift
  const weekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - weekday);
  const todayYmd = toYmd(new Date());
  const cells: Cell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    const ymd = toYmd(date);
    cells.push({
      date,
      ymd,
      inMonth: date.getMonth() === month,
      isFuture: ymd > todayYmd,
    });
  }

  return cells;
}

export function matchesHistoryDateFilter(
  createdAt: string | Date | undefined | null,
  filter: HistoryDateFilter,
): boolean {
  if (filter.kind === "all") return true;
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  if (filter.kind === "hours") {
    const from = Date.now() - filter.hours * 60 * 60 * 1000;
    return created.getTime() >= from;
  }

  return toYmd(created) === filter.ymd;
}

type HistoryDateFilterSheetProps = {
  open: boolean;
  value: HistoryDateFilter;
  onClose: () => void;
  onChange: (next: HistoryDateFilter) => void;
};

export function HistoryDateFilterSheet({
  open,
  value,
  onClose,
  onChange,
}: HistoryDateFilterSheetProps) {
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);
  const now = useMemo(() => new Date(), [open]);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const base =
      value.kind === "day"
        ? new Date(`${value.ymd}T12:00:00`)
        : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const selectedYmd = value.kind === "day" ? value.ymd : null;
  const activeHours = value.kind === "hours" ? value.hours : null;

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
      return;
    }
    setViewMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    const today = new Date();
    const next =
      viewMonth === 11
        ? { y: viewYear + 1, m: 0 }
        : { y: viewYear, m: viewMonth + 1 };
    if (
      next.y > today.getFullYear()
      || (next.y === today.getFullYear() && next.m > today.getMonth())
    ) {
      return;
    }
    setViewYear(next.y);
    setViewMonth(next.m);
  };

  const canGoNext = useMemo(() => {
    const today = new Date();
    return (
      viewYear < today.getFullYear()
      || (viewYear === today.getFullYear() && viewMonth < today.getMonth())
    );
  }, [viewYear, viewMonth]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      aria-modal="true"
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
    >
      <div
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden />

        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{t("coupon.dateSheetTitle")}</h2>
            <p className={styles.subtitle}>{t("coupon.dateSheetSubtitle")}</p>
          </div>
          <button
            aria-label={t("notify.close")}
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className={styles.presets}>
          <button
            className={`${styles.preset} ${value.kind === "all" ? styles.presetActive : ""}`}
            onClick={() => {
              onChange({ kind: "all" });
              onClose();
            }}
            type="button"
          >
            {t("coupon.dateAllTime")}
          </button>
          {HOUR_PRESETS.map((hours) => (
            <button
              key={hours}
              className={`${styles.preset} ${activeHours === hours ? styles.presetActive : ""}`}
              onClick={() => {
                onChange({ kind: "hours", hours });
                onClose();
              }}
              type="button"
            >
              {t("coupon.dateHoursAgo", { hours })}
            </button>
          ))}
        </div>

        <div className={styles.monthRow}>
          <button
            aria-label={t("coupon.datePrevMonth")}
            className={styles.monthNav}
            onClick={goPrevMonth}
            type="button"
          >
            <FiChevronLeft size={20} />
          </button>
          <span className={styles.monthLabel}>
            {viewYear} {t(`coupon.month${viewMonth + 1}` as MessageKey)}
          </span>
          <button
            aria-label={t("coupon.dateNextMonth")}
            className={styles.monthNav}
            disabled={!canGoNext}
            onClick={goNextMonth}
            type="button"
          >
            <FiChevronRight size={20} />
          </button>
        </div>

        <div className={styles.weekdays}>
          {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
            <span className={styles.weekday} key={n}>
              {t(`coupon.weekday${n}` as MessageKey)}
            </span>
          ))}
        </div>

        <div className={styles.grid}>
          {cells.map((cell) => {
            const selected = selectedYmd === cell.ymd;
            return (
              <button
                key={cell.ymd}
                className={[
                  styles.day,
                  !cell.inMonth ? styles.dayMuted : "",
                  selected ? styles.daySelected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={cell.isFuture}
                onClick={() => {
                  onChange({ kind: "day", ymd: cell.ymd });
                  onClose();
                }}
                type="button"
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
