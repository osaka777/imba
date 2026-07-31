"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FiClock } from "react-icons/fi";

import { api, components } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import {
  HISTORY_STATUS_FILTERS,
  matchesHistoryStatusFilter,
  normalizeBetHistoryStatus,
  type HistoryStatusFilter,
} from "~/entities/bet/lib/betHistoryStatus";
import { getMyWcBetsGrouped } from "~/entities/wc-odds/api/getMyWcBets";
import { mapWcBetsForHistory } from "~/entities/wc-odds/lib/mapWcBetsForHistory";
import { mapWcExpressForHistory } from "~/entities/wc-odds/lib/mapWcExpressForHistory";
import { LoadingSpinner } from "~/shared/ui";
import type { MessageKey } from "~/shared/i18n/messages";
import { useLocale } from "~/shared/model/useLocale";

import { BetHistoryCard } from "./BetHistoryCard";
import styles from "./BetsHistoryPage.module.css";
import {
  HistoryDateFilterSheet,
  matchesHistoryDateFilter,
  type HistoryDateFilter,
} from "./HistoryDateFilterSheet";

type TabType = "all" | "express" | "ordinar";
type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

interface BetsResponse {
  express: ExpressBetDto[];
  ordinar: BetDto[];
}

const STATUS_LABEL_KEYS: Record<HistoryStatusFilter, MessageKey> = {
  all: "coupon.historyAllStatuses",
  pending: "coupon.historyPending",
  cashout: "coupon.historyCashout",
  win: "coupon.historyWin",
  lose: "coupon.historyLose",
  return: "coupon.historyReturn",
};

function formatDateFilterHint(
  filter: HistoryDateFilter,
  t: (key: MessageKey, params?: { hours?: number }) => string,
): string | null {
  if (filter.kind === "all") return null;
  if (filter.kind === "hours") return t("coupon.dateLastHours", { hours: filter.hours });
  const [y, m, d] = filter.ymd.split("-").map(Number);
  if (!y || !m || !d) return filter.ymd;
  return `${d} ${t(`coupon.monthShort${m}` as MessageKey)} ${y}`;
}

export const BetsHistory: React.FC = () => {
  const { t } = useLocale();
  const [tab, setTab] = useState<TabType>("all");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>({ kind: "all" });
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  const tabs = useMemo(
    () => [
      { id: "all" as const, label: t("coupon.all") },
      { id: "ordinar" as const, label: t("coupon.ordinar") },
      { id: "express" as const, label: t("coupon.express") },
    ],
    [t],
  );

  const { data: bets, isLoading } = useQuery<BetsResponse>({
    queryKey: ["bets"],
    queryFn: async (): Promise<BetsResponse> => {
      const token = await getSessionClient();
      if (!token) return { express: [], ordinar: [] };

      try {
        const { data, error } = await api.GET("/api/bet", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (error) {
          console.error("Error fetching bets:", error);
          return { express: [], ordinar: [] };
        }

        return (data as BetsResponse) || { express: [], ordinar: [] };
      } catch (error) {
        console.error("Error in BetsHistory queryFn:", error);
        return { express: [], ordinar: [] };
      }
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const { data: wcGrouped = { ordinar: [], express: [] }, isLoading: wcLoading } = useQuery({
    queryKey: ["wc-bets", "all"],
    queryFn: () => getMyWcBetsGrouped(),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const wcAsOrdinar = mapWcBetsForHistory(wcGrouped.ordinar);
  const wcAsExpress = mapWcExpressForHistory(wcGrouped.express);

  const mergedBets = useMemo(
    () => ({
      express: [...(bets?.express || []), ...wcAsExpress],
      ordinar: [...(bets?.ordinar || []), ...wcAsOrdinar],
    }),
    [bets, wcAsOrdinar, wcAsExpress],
  );

  const tabFilteredBets = useMemo(() => {
    const list =
      tab === "all"
        ? [...mergedBets.express, ...mergedBets.ordinar]
        : tab === "express"
          ? mergedBets.express
          : mergedBets.ordinar;

    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [mergedBets, tab]);

  const filteredBets = useMemo(
    () =>
      tabFilteredBets.filter((bet) => {
        if (!matchesHistoryStatusFilter(bet as Record<string, unknown>, statusFilter)) {
          return false;
        }
        return matchesHistoryDateFilter(
          (bet as { createdAt?: string }).createdAt,
          dateFilter,
        );
      }),
    [tabFilteredBets, statusFilter, dateFilter],
  );

  const stats = useMemo(() => {
    const all = [...mergedBets.express, ...mergedBets.ordinar] as Record<string, unknown>[];
    const counts = {
      total: all.length,
      pending: 0,
      cashout: 0,
      win: 0,
      lose: 0,
      return: 0,
    };
    for (const bet of all) {
      const s = normalizeBetHistoryStatus(bet);
      if (s === "PENDING") counts.pending += 1;
      else if (s === "CASHOUT") counts.cashout += 1;
      else if (s === "WIN") counts.win += 1;
      else if (s === "LOSE") counts.lose += 1;
      else if (s === "RETURN") counts.return += 1;
    }
    return counts;
  }, [mergedBets]);

  const loading = isLoading || wcLoading;
  const dateHint = formatDateFilterHint(dateFilter, t);
  const dateActive = dateFilter.kind !== "all";

  const pluralBets = (n: number): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t("coupon.betWord1");
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return t("coupon.betWord2");
    return t("coupon.betWord5");
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link className={styles.backLink} href="/profile">
          {t("coupon.backToProfile")}
        </Link>
        <h1 className={styles.pageTitle}>{t("coupon.historyTitle")}</h1>
        {!loading && stats.total > 0 ? (
          <p className={styles.pageSubtitle}>
            {stats.total} {pluralBets(stats.total)}
            {stats.win > 0 ? ` · ${stats.win} ${t("coupon.statsWinsShort")}` : ""}
            {stats.pending > 0 ? ` · ${stats.pending} ${t("coupon.statsPendingShort")}` : ""}
          </p>
        ) : null}
      </header>

      {!loading && stats.total > 0 ? (
        <div className={styles.statsRow}>
          <StatPill
            active={statusFilter === "all"}
            label={t("coupon.historyTotal")}
            onClick={() => setStatusFilter("all")}
            value={stats.total}
          />
          <StatPill
            active={statusFilter === "win"}
            label={t("coupon.historyWin")}
            onClick={() => setStatusFilter("win")}
            tone="win"
            value={stats.win}
          />
          <StatPill
            active={statusFilter === "lose"}
            label={t("coupon.historyLose")}
            onClick={() => setStatusFilter("lose")}
            tone="lose"
            value={stats.lose}
          />
        </div>
      ) : null}

      <div className={styles.tabsRow}>
        <div className={styles.typeTabs} role="tablist" aria-label={t("coupon.historyTitle")}>
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-selected={tab === item.id}
              className={`${styles.typeTab} ${tab === item.id ? styles.typeTabActive : ""}`}
              onClick={() => setTab(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          aria-label={t("coupon.dateFilterAria")}
          className={`${styles.dateBtn} ${dateActive ? styles.dateBtnActive : ""}`}
          onClick={() => setDateSheetOpen(true)}
          type="button"
        >
          <FiClock size={20} aria-hidden />
          {dateActive ? <span className={styles.dateBtnDot} aria-hidden /> : null}
        </button>
      </div>

      {dateHint ? (
        <p className={styles.dateFilterHint}>
          {t("coupon.dateFilterShown", { hint: dateHint })}
        </p>
      ) : null}

      <div className={styles.filterBar}>
        {HISTORY_STATUS_FILTERS.map((item) => (
          <button
            key={item.id}
            className={`${styles.filterChip} ${styles.filterChipSubtle} ${statusFilter === item.id ? styles.filterChipStatusActive : ""}`}
            onClick={() => setStatusFilter(item.id)}
            type="button"
          >
            {t(STATUS_LABEL_KEYS[item.id])}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner />
            <span className={styles.loadingText}>{t("coupon.loadingBets")}</span>
          </div>
        ) : !filteredBets.length ? (
          <div className={styles.emptyBlock}>
            <p className={styles.emptyTitle}>{t("coupon.emptyTitle")}</p>
            <p className={styles.emptyText}>
              {statusFilter !== "all" || tab !== "all" || dateActive
                ? t("coupon.historyEmptyFiltered")
                : t("coupon.historyEmpty")}
            </p>
          </div>
        ) : (
          filteredBets.map((bet, index) => {
            const betType =
              (bet as { betVariant?: string }).betVariant === "EXPRESS"
                ? "express"
                : "ordinar";
            const uniqueKey = `${betType}-${bet.id}-${index}`;
            return <BetHistoryCard bet={bet} key={uniqueKey} />;
          })
        )}
      </div>

      <HistoryDateFilterSheet
        onChange={setDateFilter}
        onClose={() => setDateSheetOpen(false)}
        open={dateSheetOpen}
        value={dateFilter}
      />
    </div>
  );
};

function StatPill({
  label,
  value,
  active,
  onClick,
  tone,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone?: "pending" | "cashout" | "win" | "lose";
}) {
  return (
    <button
      className={[
        styles.statPill,
        active ? styles.statPillActive : "",
        tone ? styles[`statPill_${tone}`] : "",
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      type="button"
    >
      <span className={styles.statPillValue}>{value}</span>
      <span className={styles.statPillLabel}>{label}</span>
    </button>
  );
}
