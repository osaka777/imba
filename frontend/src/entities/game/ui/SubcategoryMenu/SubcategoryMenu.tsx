"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useMemo, useEffect } from "react";
import React from "react";

import { useSportFilter } from "~/entities/game/lib/useSportFilter";
import { lineAllHref, lineSportHref, liveAllHref, liveSportHref } from "~/entities/game/lib/sportPagePaths";

import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import { useLocale } from "~/shared/model/useLocale";
import { ArrowIcon, FireIcon } from "~/shared/assets";

import { getSubcategories, getLiveSubcategoryCounts, getPrematchSubcategoryCounts, getSubcategoriesWithCounts } from "../../api";
import { Subcategory } from "../../types";
import styles from "./SubcategoryMenu.module.css";

type SubcategoryCounts = {
  [key: string]: number;
};

type SubcategoriesWithCountsData = {
  subcategories: Subcategory[];
  counts: SubcategoryCounts;
  total: number;
};

const SubcategoryMenuComponent = ({
  type,
  layout = "horizontal",
}: {
  type: "live" | "prematch";
  layout?: "horizontal" | "sidebar";
}) => {
  const { t } = useLocale();
  const params = useParams();
  const sport = useSportFilter();
  const subcategory = params?.subcategory as string | undefined;
  const queryClient = useQueryClient();

  // Prefetch соседних спортов для ускорения навигации
  useEffect(() => {
    if (!sport) return;
    
    const popularSports = ['soccer', 'basketball', 'hockey', 'tennis'];
    const currentIndex = popularSports.indexOf(sport);
    
    if (currentIndex !== -1) {
      // Prefetch предыдущий и следующий спорт
      const prevSport = popularSports[currentIndex - 1];
      const nextSport = popularSports[currentIndex + 1];
      
      if (prevSport) {
        queryClient.prefetchQuery({
          queryKey: ["subcategoriesWithCounts", prevSport, type],
          queryFn: () => getSubcategoriesWithCounts(prevSport, type).catch(() => ({ subcategories: [], counts: {}, total: 0 })),
          staleTime: 10000,
        });
      }
      
      if (nextSport) {
        queryClient.prefetchQuery({
          queryKey: ["subcategoriesWithCounts", nextSport, type],
          queryFn: () => getSubcategoriesWithCounts(nextSport, type).catch(() => ({ subcategories: [], counts: {}, total: 0 })),
          staleTime: 10000,
        });
      }
    }
  }, [sport, type, queryClient]);

  // Мемоизируем URL изображений
  const getImageUrl = useMemo(() => (flag: string) => {
    // Если путь не указан, возвращаем дефолтный флаг
    if (!flag) {
      return '/flags/other.webp';
    }

    // Если путь уже в правильном формате, возвращаем как есть
    if (flag.startsWith('/flags/') && flag.endsWith('.webp')) {
      return flag;
    }

    // Если это data URL, возвращаем как есть
    if (flag.startsWith('data:')) {
      return flag;
    }

    // Если это код страны без расширения, добавляем путь и расширение
    if (!flag.includes('/')) {
      return `/flags/${flag}.webp`;
    }

    // Для всех остальных случаев возвращаем дефолтный флаг
    return '/flags/other.webp';
  }, []);

  // Функция для параллельного выполнения запросов
  const fetchSubcategoriesAndCounts = async (): Promise<SubcategoriesWithCountsData> => {
    console.log('🚀 fetchSubcategoriesAndCounts called with:', { sport, type });  
    
    if (!sport) return { subcategories: [], counts: {}, total: 0 };
    
    try {
      console.log('🎯 Trying new combined endpoint...');
      // Вариант 1: Используем новый общий эндпоинт (если доступен)
      const result = await getSubcategoriesWithCounts(sport, type);
      console.log('✅ Combined endpoint success:', result);
      return result as unknown as SubcategoriesWithCountsData;
    } catch (error) {
      console.warn('❌ Common endpoint failed, falling back to parallel requests:', error);
      console.log('🔄 Using fallback: parallel requests...');
      
      // Вариант 2: Fallback - параллельные запросы через Promise.all
      const [subcategories, counts] = await Promise.all([
        getSubcategories(sport),
        type === "live" ? getLiveSubcategoryCounts() : getPrematchSubcategoryCounts()
      ]);
      
      console.log('📦 Fallback results:', { subcategories, counts, type });
      
      const sportCounts = (counts as any)[sport] || {};
      const total = sportCounts.total || Object.values(sportCounts).reduce((sum: number, count: any) => sum + (typeof count === 'number' ? count : 0), 0);
      
      const fallbackResult = {
        subcategories: subcategories as Subcategory[],
        counts: sportCounts,
        total
      };
      
      console.log('🔄 Fallback final result:', fallbackResult);
      return fallbackResult;
    }
  };

  const { data, isLoading, error } = useQuery<SubcategoriesWithCountsData>({
    queryKey: ["subcategoriesWithCounts", sport, type],
    queryFn: fetchSubcategoriesAndCounts,
    enabled: !!sport,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 10000, // 10 секунд кэширования
    gcTime: 1000 * 60 * 5, // 5 минут жизни кэша
  });

  // Мемоизируем сортировку подкатегорий
  const sortedSubcategories = useMemo(
    () => (data?.subcategories || []).sort((a: Subcategory, b: Subcategory) => {
      const priorityOrder = {
        "other": 0,
        "europe": 1,
        "england": 2,
        "france": 3,
        "italy": 4,
        "spain": 5,
        "germany": 6,
        "russia": 7,
        "ukraine": 8
      };

      const aCode = a.code.toLowerCase();
      const bCode = b.code.toLowerCase();

      const aPriority = priorityOrder[aCode as keyof typeof priorityOrder];
      const bPriority = priorityOrder[bCode as keyof typeof priorityOrder];

      if (aPriority !== undefined && bPriority !== undefined) {
        return aPriority - bPriority;
      }

      if (aPriority !== undefined) return -1;
      if (bPriority !== undefined) return 1;

      return a.name.localeCompare(b.name);
    }),
    [data?.subcategories]
  );

  // Логирование спорта
  useEffect(() => {
    // console.log('Sport:', sport); // Убрано для улучшения производительности
  }, [sport]);

  // console.log('Combined data:', data);
  // console.log('Is loading:', isLoading);

  if (!sport) return null;
  
  // Показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className={cn(styles.menu, layout === "sidebar" && styles.menu_sidebar)}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>{t("common.loadingSubcats")}</div>
        </div>
      </div>
    );
  }
  
  // Показываем ошибку, если есть
  if (error) {
    console.error('Error loading subcategories:', error);
    return (
      <div className={cn(styles.menu, layout === "sidebar" && styles.menu_sidebar)}>
        <div className={styles.wrapper}>
          <div className={styles.error}>{t("common.subcatsLoadError")}</div>
        </div>
      </div>
    );
  }
  
  const subcategories = data?.subcategories || [];
  const sportCounts = data?.counts || {};
  const totalCount = data?.total || 0;
  
  const basePath = type === "live" ? "" : "/line";
  const backPath = type === "live" ? liveAllHref() : lineAllHref();
  const sportAllHref = type === "live" ? liveSportHref(sport!) : lineSportHref(sport!);
  

  // Check if we're on the main sport page (no subcategory selected)
  const isMainSportPage = !subcategory || subcategory === '';
  // console.log('Is main sport page:', isMainSportPage);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    console.error('Failed to load image:', target.src);
    target.src = '/flags/other.webp';
  };
  
  return (
    <div className={cn(styles.menu, layout === "sidebar" && styles.menu_sidebar)}>
      <div className={styles.wrapper}>
        <Button
          className={styles.backButton}
          elementType="link"
          href={backPath}
        >
          <ArrowIcon className={styles.backIcon} />
          <span>{t("common.back")}</span>
        </Button>

        {/* Add "All" button */}
        <Button
          className={cn(
            styles.item,
            isMainSportPage && styles.item_active
          )}
          elementType="link"
          href={sportAllHref}
          scroll={layout === "sidebar" ? false : undefined}
        >
          <p className={styles.text}>
            {t("common.all")}
            {totalCount > 0 && (
              <span className={styles.count}>{totalCount}</span>
            )}
          </p>
        </Button>

        {sortedSubcategories
          .map((subcat: Subcategory) => {
            const count = sportCounts[subcat.code] || 0;
            if (count === 0) return null;

            return (
              <Button
                key={subcat.code}
                className={cn(
                  styles.item,
                  subcategory === subcat.code && styles.item_active,
                  subcat.isPriority && styles.item_priority
                )}
                elementType="link"
                href={`${basePath}/${sport}/${subcat.code}`}
                onClick={() => {
                  console.log('Subcategory link clicked:', {
                    type,
                    basePath,
                    sport,
                    subcategoryCode: subcat.code,
                    fullHref: `${basePath}/${sport}/${subcat.code}`
                  });
                }}
              >
                {subcat.flag && (
                  <img
                    key={`${subcat.code}-${subcat.flag}`}
                    src={getImageUrl(subcat.flag)}
                    alt={`${subcat.name} flag`}
                    width={20}
                    height={15}
                    className={styles.flag}
                    loading="lazy"
                    crossOrigin="anonymous"
                    onError={handleImageError}
                  />
                )}
                <p className={styles.text}>{subcat.name}</p>
                <span className={styles.count}>{count}</span>
                {subcat.isPriority && (
                  <FireIcon className={styles.priority} />
                )}
              </Button>
            );
          })}
      </div>
    </div>
  );
};

export const SubcategoryMenu = React.memo(SubcategoryMenuComponent);