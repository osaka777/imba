"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { api, components } from "~/shared/api";
import { getSessionClient } from "~/entities/user/lib";
import { getMyWcBets } from "~/entities/wc-odds/api/getMyWcBets";
import { mapWcBetsForHistory } from "~/entities/wc-odds/lib/mapWcBetsForHistory";
import { LoadingSpinner } from "~/shared/ui";

import { BetHistoryCard } from "./BetHistoryCard";
import styles from "./BetsHistoryPage.module.css";

type TabType = "all" | "express" | "ordinar";
type BetDto = components["schemas"]["BetDto"];
type ExpressBetDto = components["schemas"]["ExpressBetDto"];

interface BetsResponse {
  express: ExpressBetDto[];
  ordinar: BetDto[];
}

const TABS: { id: TabType; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "ordinar", label: "Ординар" },
  { id: "express", label: "Экспресс" },
];

export const BetsHistory: React.FC = () => {
  const [tab, setTab] = useState<TabType>("all");

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

  const { data: wcBets = [], isLoading: wcLoading } = useQuery({
    queryKey: ["wc-bets", "all"],
    queryFn: () => getMyWcBets(),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const wcAsOrdinar = mapWcBetsForHistory(wcBets);

  const mergedBets = useMemo(
    () => ({
      express: bets?.express || [],
      ordinar: [...(bets?.ordinar || []), ...wcAsOrdinar],
    }),
    [bets, wcAsOrdinar],
  );

  const filteredBets = useMemo(() => {
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

  const stats = useMemo(() => {
    const all = [...mergedBets.express, ...mergedBets.ordinar];
    return {
      total: all.length,
      wins: all.filter((b) => b.status === "WIN").length,
      pending: all.filter((b) => b.status === "PENDING").length,
    };
  }, [mergedBets]);

  const loading = isLoading || wcLoading;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Link className={styles.backLink} href="/profile">
          ← Профиль
        </Link>
        <h1 className={styles.pageTitle}>История ставок</h1>
        {!loading && stats.total > 0 ? (
          <p className={styles.pageSubtitle}>
            {stats.total} {pluralBets(stats.total)}
            {stats.wins > 0 ? ` · ${stats.wins} выигр.` : ""}
            {stats.pending > 0 ? ` · ${stats.pending} в игре` : ""}
          </p>
        ) : null}
      </header>

      <div className={styles.filterBar}>
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`${styles.filterChip} ${tab === item.id ? styles.filterChipActive : ""}`}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner />
            <span className={styles.loadingText}>Загрузка ставок…</span>
          </div>
        ) : !filteredBets.length ? (
          <div className={styles.emptyBlock}>
            <span className={styles.emptyIcon} aria-hidden>
              📋
            </span>
            <p className={styles.emptyTitle}>Пока пусто</p>
            <p className={styles.emptyText}>
              {tab === "all"
                ? "Здесь появятся ваши ставки после первого пари"
                : `Нет ставок в разделе «${TABS.find((t) => t.id === tab)?.label}»`}
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
    </div>
  );
};

function pluralBets(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ставка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ставки";
  return "ставок";
}
