"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useCybersportCounts } from "~/entities/cybersport/hooks/useCybersportCounts";
import {
  cyberMoreSports,
  pickQuickCyberSports,
  sortCyberSportItems,
} from "~/entities/cybersport/lib/cyberDisciplineSort";
import { CYBER_SPORTS, DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";

import styles from "./CybersportSportFilter.module.css";

type CybersportSportFilterProps = {
  sport: string;
  onChange: (sport: string) => void;
};

function SportGlyph({ item }: { item: (typeof CYBER_SPORTS)[number] }) {
  const { Icon, label } = item;
  return <Icon aria-label={label} className={styles.icon} />;
}

function SportIconButton({
  item,
  active,
  count,
  onClick,
}: {
  item: (typeof CYBER_SPORTS)[number];
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const { label } = item;

  return (
    <button
      className={cn(styles.item, active ? styles.item_pill : styles.item_circle)}
      onClick={onClick}
      title={count > 0 ? `${label} · ${count}` : label}
      type="button"
    >
      <SportGlyph item={item} />
      {active && <span className={styles.label}>{label}</span>}
      {!active && count > 0 ? <span className={styles.badge}>{count}</span> : null}
    </button>
  );
}

export function CybersportSportFilter({ sport, onChange }: CybersportSportFilterProps) {
  const { t } = useLocale();
  const activeSport = sport || DEFAULT_CYBER_SPORT;
  const { data: counts = {} } = useCybersportCounts();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => sortCyberSportItems(CYBER_SPORTS, counts), [counts]);
  const quick = useMemo(
    () => pickQuickCyberSports(sorted, counts, activeSport),
    [sorted, counts, activeSport],
  );
  const more = useMemo(
    () => cyberMoreSports(sorted, quick, counts),
    [sorted, quick, counts],
  );
  const activeInMore = more.some((item) => item.name === activeSport);

  useEffect(() => {
    if (!moreOpen) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [moreOpen]);

  return (
    <div className={styles.filter}>
      <div className={styles.track}>
        {quick.map((item) => (
          <SportIconButton
            active={activeSport === item.name}
            count={counts[item.name] ?? 0}
            item={item}
            key={item.name}
            onClick={() => onChange(item.name)}
          />
        ))}

        {more.length > 0 ? (
          <div className={styles.moreWrap} ref={moreRef}>
            <button
              className={cn(
                styles.item,
                styles.item_more,
                (moreOpen || activeInMore) && styles.item_more_active,
              )}
              onClick={() => setMoreOpen((open) => !open)}
              type="button"
            >
              <span className={styles.moreLabel}>
                {activeInMore
                  ? (sorted.find((item) => item.name === activeSport)?.label ?? t("common.more"))
                  : t("common.more")}
              </span>
              <span className={styles.moreChevron} aria-hidden>
                ▾
              </span>
            </button>

            {moreOpen ? (
              <div className={styles.morePanel} role="listbox">
                {more.map((item) => {
                  const count = counts[item.name] ?? 0;
                  const active = activeSport === item.name;

                  return (
                    <button
                      className={cn(styles.moreItem, active && styles.moreItem_active)}
                      key={item.name}
                      onClick={() => {
                        onChange(item.name);
                        setMoreOpen(false);
                      }}
                      role="option"
                      type="button"
                    >
                      <SportGlyph item={item} />
                      <span className={styles.moreItemLabel}>{item.label}</span>
                      {count > 0 ? (
                        <span className={styles.moreItemCount}>{count}</span>
                      ) : (
                        <span className={styles.moreItemEmpty}>—</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
