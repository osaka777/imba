"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import {
  WC_LINE_TIME_OPTIONS,
  getLineTimeOption,
  type WcLineHoursFilter,
} from "~/entities/wc-odds/line/wcLineTimeFilter";
import { formatLineDateLabel } from "~/entities/wc-odds/line/wcLineDateFilter";
import { isSegmentedLineFilterDesign } from "~/entities/wc-odds/line/lineFilterDesign";

import styles from "~/entities/wc-odds/line/OlimpbetLineFilter.module.css";

type OpenMenu = "time" | "date" | null;

type OlimpbetLineFilterProps = {
  hoursFilter: WcLineHoursFilter;
  dateFilter: string | null;
  timeCounts: Record<string, number>;
  dates: string[];
  onSelectAll: () => void;
  onHoursChange: (value: WcLineHoursFilter) => void;
  onDateChange: (value: string) => void;
  className?: string;
};

function isTimeOptionDisabled(
  optionId: WcLineHoursFilter,
  activeId: WcLineHoursFilter,
  counts: Record<string, number>,
): boolean {
  if (optionId === activeId) return false;
  if (optionId === "all") return false;
  return (counts[optionId] ?? 0) === 0;
}

export function OlimpbetLineFilter({
  hoursFilter,
  dateFilter,
  timeCounts,
  dates,
  onSelectAll,
  onHoursChange,
  onDateChange,
  className,
}: OlimpbetLineFilterProps) {
  const { t, locale } = useLocale();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const segmented = isSegmentedLineFilterDesign();

  const isAllActive = hoursFilter === "all" && !dateFilter;
  const isTimeActive = hoursFilter !== "all";
  const isDateActive = Boolean(dateFilter);

  const timeOptions = WC_LINE_TIME_OPTIONS.filter((option) => option.id !== "all");
  const activeTimeOption = getLineTimeOption(hoursFilter);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const dateButtonLabel =
    isDateActive && dateFilter ? formatLineDateLabel(dateFilter, locale) : t("wc.filterDate");

  const timeButtonLabel =
    isTimeActive
      ? (activeTimeOption ? t(activeTimeOption.shortLabelKey) : t("wc.filterTime"))
      : t("wc.filterTime");

  return (
    <div
      className={cn(
        styles.root,
        segmented ? styles.root_segmented : styles.root_legacy,
        className,
      )}
      ref={rootRef}
    >
      {segmented ? <div className={styles.sectionTitle}>{t("wc.filterPeriod")}</div> : null}

      <div className={styles.filterBar} role="group" aria-label={t("wc.lineFilter")}>
        <button
          type="button"
          className={cn(styles.segment, isAllActive && styles.segment_active)}
          aria-pressed={isAllActive}
          onClick={() => {
            setOpenMenu(null);
            onSelectAll();
          }}
        >
          {t("common.all")}
        </button>

        <div className={styles.segmentWrap}>
          <button
            type="button"
            className={cn(
              styles.segment,
              (isTimeActive || openMenu === "time") && styles.segment_active,
            )}
            aria-expanded={openMenu === "time"}
            aria-haspopup="listbox"
            onClick={() => toggleMenu("time")}
          >
            <span>{timeButtonLabel}</span>
            <span className={styles.chevron} aria-hidden>
              ▾
            </span>
          </button>
          {openMenu === "time" && (
            <div className={styles.menu} role="listbox">
              {timeOptions.map((option) => {
                const count = timeCounts[option.id] ?? 0;
                const active = option.id === hoursFilter;
                const disabled = isTimeOptionDisabled(option.id, hoursFilter, timeCounts);
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
                    onClick={() => {
                      onHoursChange(option.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t(option.labelKey)}</span>
                    <span className={styles.count}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.segmentWrap}>
          <button
            type="button"
            className={cn(
              styles.segment,
              (isDateActive || openMenu === "date") && styles.segment_active,
            )}
            aria-expanded={openMenu === "date"}
            aria-haspopup="listbox"
            onClick={() => toggleMenu("date")}
            disabled={dates.length === 0}
          >
            <span>{dateButtonLabel}</span>
            <span className={styles.chevron} aria-hidden>
              ▾
            </span>
          </button>
          {openMenu === "date" && dates.length > 0 && (
            <div className={styles.menu} role="listbox">
              {dates.map((date) => {
                const active = date === dateFilter;
                return (
                  <button
                    key={date}
                    type="button"
                    className={cn(styles.item, active && styles.item_active)}
                    onClick={() => {
                      onDateChange(date);
                      setOpenMenu(null);
                    }}
                  >
                    <span>{formatLineDateLabel(date, locale)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
