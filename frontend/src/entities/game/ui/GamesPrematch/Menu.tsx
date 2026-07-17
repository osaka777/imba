import { useQuery } from "@tanstack/react-query";

import { useSportFilter } from "~/entities/game/lib/useSportFilter";
import { lineAllHref, lineSportHref } from "~/entities/game/lib/sportPagePaths";
import { useSportMenuRows } from "~/entities/cybersport/hooks/useSportMenuRows";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import { getPrematchGameCounts, GameCounts } from "../../api/getGameCounts";
import { fetchWcLineCounts } from "~/entities/wc-odds/api/client";
import { FireIcon } from "~/shared/assets";
import { getAllSubcategories } from "../../api/getSubcategories";

import styles from "./Menu.module.css";

type MenuLayout = "horizontal" | "sidebar";

type MenuProps = {
  layout?: MenuLayout;
  className?: string;
};

export const Menu = ({ layout = "horizontal", className }: MenuProps) => {
  const sport = useSportFilter();

  const { data: gameCounts = { total: 0 }, isFetched: gameCountsFetched } = useQuery<GameCounts>({
    queryKey: ["gameCounts", "prematch"],
    queryFn: getPrematchGameCounts,
    // refetchInterval: 5000, // Убрано для улучшения производительности
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    gcTime: 1000 * 60 * 5,
  });

  // Получаем информацию о приоритетных подкатегориях для каждого спорта
  const { data: subcategoriesData = {} } = useQuery({
    queryKey: ["subcategories"],
    queryFn: getAllSubcategories,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 секунд для редко меняющихся данных
    gcTime: 1000 * 60 * 10, // 10 минут
  });

  const { data: wcLineCounts = {}, isFetched: wcLineCountsFetched } = useQuery<Record<string, number>>({
    queryKey: ["wcLineCounts"],
    queryFn: fetchWcLineCounts,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10000,
    gcTime: 1000 * 60 * 5,
  });

  // Определяем, какие спорты имеют приоритетные подкатегории
  const prioritySports = new Set(
    Object.values(subcategoriesData)
      .flat()
      .filter((sub) => sub.isPriority)
      .map((sub) => sub.sport),
  );
  if ((wcLineCounts.soccer ?? 0) > 0) {
    prioritySports.add("soccer");
  }

  const { coreRows, esportsRows, totalCount } = useSportMenuRows("line", {
    gameCounts,
    wcCounts: wcLineCounts,
    prioritySports,
  });
  const countsReady = gameCountsFetched && wcLineCountsFetched;
  const isSidebar = layout === "sidebar";

  return (
    <div className={cn(styles.Menu, layout === "sidebar" && styles.Menu_sidebar, className)}>
      <div className={styles.wrapper}>
        <Button
          className={cn(styles.item, sport == null && styles.item_active)}
          elementType="link"
          href={lineAllHref()}
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
        {coreRows
          .filter((item) => !isSidebar || !countsReady || item.count > 0)
          .map(({ Icon, label, name, count, isPriority }) => {
          return (
            <Button
              className={cn(
                styles.item,
                name === sport && styles.item_active,
                isPriority && styles.item_priority
              )}
              elementType="link"
              href={lineSportHref(name)}
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

        {esportsRows.length > 0 ? (
          <>
            <span className={styles.divider} aria-hidden />
            <span className={styles.groupLabel}>Киберспорт</span>
            {esportsRows
              .filter((item) => !isSidebar || !countsReady || item.count > 0)
              .map(({ Icon, label, name, count, isPriority }) => (
                <Button
                  className={cn(
                    styles.item,
                    name === sport && styles.item_active,
                    isPriority && styles.item_priority,
                  )}
                  elementType="link"
                  href={lineSportHref(name)}
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
              ))}
          </>
        ) : null}
      </div>
    </div>
  );
};
