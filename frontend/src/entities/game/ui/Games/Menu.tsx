"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSportFilter } from "~/entities/game/lib/useSportFilter";
import { liveAllHref, liveSportHref } from "~/entities/game/lib/sportPagePaths";
import { visibleGamesList } from "~/entities/game";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import { getLiveGameCounts, GameCounts } from "../../api/getGameCounts";
import { fetchWcLiveCounts } from "~/entities/wc-odds/api/client";
import { FireIcon } from "~/shared/assets";
import { getAllSubcategories } from "../../api/getSubcategories";

import styles from "./Menu.module.css";

type MenuLayout = "horizontal" | "sidebar";

type MenuProps = {
  layout?: MenuLayout;
  className?: string;
};

export const Menu = ({ layout = "horizontal", className }: MenuProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sport = useSportFilter();
  const broadcastOnly =
    searchParams.get("broadcast") === "1" || searchParams.get("broadcast") === "true";

  const { data: gameCounts = { total: 0 }, isFetched: gameCountsFetched } = useQuery<GameCounts>({
    queryKey: ["gameCounts", "live"],
    queryFn: getLiveGameCounts,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    gcTime: 1000 * 60 * 5,
  });

  const { data: subcategoriesData = {} } = useQuery({
    queryKey: ["subcategories"],
    queryFn: getAllSubcategories,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    gcTime: 1000 * 60 * 10,
  });

  const prioritySports = new Set(
    Object.values(subcategoriesData)
      .flat()
      .filter((sub) => sub.isPriority)
      .map((sub) => sub.sport),
  );

  const { data: wcLiveCounts = {}, isFetched: wcLiveCountsFetched } = useQuery<Record<string, number>>({
    queryKey: ["wcLiveCounts", broadcastOnly ? "broadcast" : "all"],
    queryFn: () => fetchWcLiveCounts(broadcastOnly),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    gcTime: 1000 * 60 * 5,
  });

  if ((wcLiveCounts.soccer ?? 0) > 0) {
    prioritySports.add("soccer");
  }

  const wcTotal = Object.values(wcLiveCounts).reduce((sum, count) => sum + (count || 0), 0);
  const totalCount = broadcastOnly ? wcTotal : gameCounts.total + wcTotal;
  const countsReady = gameCountsFetched && wcLiveCountsFetched;
  const isSidebar = layout === "sidebar";

  const toggleBroadcast = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (broadcastOnly) {
      next.delete("broadcast");
    } else {
      next.set("broadcast", "1");
    }
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }, [broadcastOnly, pathname, router, searchParams]);

  return (
    <div className={cn(styles.Menu, layout === "sidebar" && styles.Menu_sidebar, className)}>
      <div className={styles.wrapper}>
        <div className={styles.broadcastFilter}>
          <button
            type="button"
            className={cn(styles.broadcastToggle, broadcastOnly && styles.broadcastToggle_active)}
            role="switch"
            aria-checked={broadcastOnly}
            aria-label="С трансляциями"
            onClick={toggleBroadcast}
          >
            <span className={styles.broadcastKnob} />
          </button>
          <span className={styles.broadcastLabel}>С трансляциями</span>
        </div>

        <span className={styles.divider} aria-hidden />

        <Button
          className={cn(styles.item, sport == null && styles.item_active)}
          elementType="link"
          href={liveAllHref(broadcastOnly)}
          scroll={isSidebar ? false : undefined}
          key="All"
        >
          <p className={styles.text}>
            Все
            {totalCount > 0 && (
              <span className={styles.count}>{totalCount}</span>
            )}
          </p>
        </Button>
        {visibleGamesList()
          .map(({ Icon, label, name }) => ({
            Icon,
            label,
            name,
            count: broadcastOnly
              ? wcLiveCounts[name] || 0
              : (wcLiveCounts[name] || 0) + (gameCounts[name] || 0),
            isPriority: prioritySports.has(name),
          }))
          .filter((item) => !isSidebar || !countsReady || item.count > 0)
          .sort((a, b) => (isSidebar ? 0 : b.count - a.count))
          .map(({ Icon, label, name, count, isPriority }) => {
            return (
              <Button
                className={cn(
                  styles.item,
                  name === sport && styles.item_active,
                  isPriority && styles.item_priority,
                )}
                elementType="link"
                href={liveSportHref(name, broadcastOnly)}
                scroll={isSidebar ? false : undefined}
                key={name}
              >
                <Icon className={styles.icon} />
                <p className={styles.text}>
                  {label}
                  {count > 0 && <span className={styles.count}>{count}</span>}
                </p>
                {isPriority && <FireIcon className={styles.priority} />}
              </Button>
            );
          })}
      </div>
    </div>
  );
};
