import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { gamesList } from "~/entities/game";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import { getPrematchGameCounts, GameCounts } from "../../api/getGameCounts";
import { FireIcon } from "~/shared/assets";
import { getAllSubcategories } from "../../api/getSubcategories";

import styles from "./Menu.module.css";

export const Menu = () => {
  const params = useParams();
  const sport = params?.sport as string | undefined;

  const { data: gameCounts = { total: 0 } } = useQuery<GameCounts>({
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

  // Определяем, какие спорты имеют приоритетные подкатегории
  const prioritySports = new Set(
    Object.values(subcategoriesData)
      .flat()
      .filter((sub) => sub.isPriority)
      .map((sub) => sub.sport)
  );

  return (
    <div className={styles.Menu}>
      <div className={styles.wrapper}>
        <Button
          className={cn(styles.item, sport == null && styles.item_active)}
          elementType="link"
          href="/line"
          key="All"
        >
          <p className={styles.text}>
            Все
            {gameCounts.total > 0 && (
              <span className={styles.count}>{gameCounts.total}</span>
            )}
          </p>
        </Button>
        {Object.values(gamesList)
          .map(({ Icon, label, name }) => ({
            Icon,
            label,
            name,
            count: gameCounts[name] || 0,
            isPriority: prioritySports.has(name)
          }))
          .sort((a, b) => b.count - a.count)
          .map(({ Icon, label, name, count, isPriority }) => {
          return (
            <Button
              className={cn(
                styles.item,
                name === sport && styles.item_active,
                isPriority && styles.item_priority
              )}
              elementType="link"
              href={`/line/${name}`}
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
