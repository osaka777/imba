"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { ArrowIcon, ArrowTopIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";
import type { WcEventDetail, WcMarketGroup } from "~/entities/wc-odds/api/client";
import { localizeWcLabel } from "~/entities/wc-odds/lib/localizeWcLabel";
import {
  buildMarketTabs,
  filterGroupedMarketsByTab,
  formatWcCategoryCompactName,
  formatWcCategoryDisplayName,
  is1X2Category,
  isMainMatch1X2Category,
  isWcMobileDefaultOpenCategory,
  mergeEntriesByDisplayName,
  regroupEntriesForDisplay,
  type WcMarketTabId,
} from "~/entities/wc-odds/lib/wcOddsCategories";
import { expandDoubleChanceScopeCategories } from "~/entities/wc-odds/lib/wcDoubleChanceScope";
import { expandWinnerScopeCategories } from "~/entities/wc-odds/lib/wcWinScope";
import { expandGoalsTeamCategories } from "~/entities/wc-odds/lib/wcGoalsTeamScope";
import { expandBundledYesNoCategories, expandYesNoLineCategories, expandYesNoScopedCategories } from "~/entities/wc-odds/lib/wcYesNoLineTitle";
import { expandEvenOddScopeCategories } from "~/entities/wc-odds/lib/wcEvenOddScope";
import { expandTimeWindowYesNoCategories } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import { expandScopedMarketEntries } from "~/entities/wc-odds/lib/wcScopedMarketSplit";
import { filterDisplayableGroups, deduplicateGroupsByOdds } from "~/entities/wc-odds/lib/wcMarketVisibility";
import { filterFinalizedScopeMarketEntries } from "~/entities/wc-odds/lib/wcScopeMarketFilter";
import { isJunkMarketCategoryName } from "~/entities/wc-odds/lib/wcJunkMarkets";
import { isWcVisibleMarketKey } from "~/entities/wc-odds/lib/wcRate";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import { useWcMatchMobileLayout } from "~/entities/wc-odds/lib/useWcMatchMobileLayout";
import { useWcFreshMarketEntries } from "~/entities/wc-odds/lib/useWcFreshMarketEntries";
import {
  countEntriesByTab,
  dedupeCyberMapCategoryEntries,
  formatCyberTabCompactLabel,
  groupEntriesByCyberSection,
  shouldDefaultFoldCyberCategory,
} from "~/entities/wc-odds/lib/wcCyberOddsLayout";
import { WcOddsItem } from "~/entities/wc-odds/ui/WcOddsItem";
import FireIcon from "~/shared/assets/icons/fire.svg?component";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";

type WcOddsTableProps = {
  event: WcEventDetail;
  /** Visible accordion title (may be localized). */
  name: string;
  /** Original RU/feed category name for market matching logic. */
  categoryName?: string;
  groups: WcMarketGroup[];
  isParentExpanded: boolean;
  bettingOpen: boolean;
  defaultFolded: boolean;
  lazyMount: boolean;
  title?: string;
  kickChip?: boolean;
};

const WcOddsTable = memo(function WcOddsTable({
  event,
  name,
  categoryName,
  groups,
  isParentExpanded,
  bettingOpen,
  defaultFolded,
  lazyMount,
  title,
  kickChip = false,
}: WcOddsTableProps) {
  const [isFolded, setIsFolded] = useState(defaultFolded);
  const logicName = categoryName ?? name;

  useEffect(() => {
    setIsFolded(defaultFolded);
  }, [event.id, logicName, defaultFolded]);

  useEffect(() => {
    if (!isParentExpanded) {
      setIsFolded(true);
      return;
    }
    setIsFolded(defaultFolded);
  }, [isParentExpanded, defaultFolded]);

  const showContent = isParentExpanded && !isFolded;
  const mountContent = showContent || !lazyMount;

  const headerTitle = title ?? name;

  if (!isParentExpanded) {
    return (
      <div>
        <Button className={matchStyles.oddFold} onClick={() => setIsFolded(false)} title={headerTitle}>
          <p className={matchStyles.oddGroupName}>{name}</p>
          <ArrowIcon className="size-3 fill-white" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        className={matchStyles.oddFold}
        onClick={() => setIsFolded((folded) => !folded)}
        title={headerTitle}
        type="button"
      >
        <p className={matchStyles.oddGroupName}>{name}</p>
        <ArrowIcon className={cn("size-3 fill-white transition-transform", !isFolded && "rotate-180")} />
      </Button>
      {mountContent ? (
        <div className={cn(matchStyles.oddsList, isFolded && matchStyles.oddsList_hidden)}>
          {showContent ? (
            <WcOddsItem
              bettingOpen={bettingOpen}
              categoryName={logicName}
              event={event}
              groups={groups}
              kickChip={kickChip}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}, (prev, next) => {
  if (prev.name !== next.name) return false;
  if (prev.categoryName !== next.categoryName) return false;
  if (prev.bettingOpen !== next.bettingOpen) return false;
  if (prev.isParentExpanded !== next.isParentExpanded) return false;
  if (prev.defaultFolded !== next.defaultFolded) return false;
  if (prev.lazyMount !== next.lazyMount) return false;
  if (prev.title !== next.title) return false;
  if (prev.event.id !== next.event.id) return false;
  if (prev.groups === next.groups) return true;
  return JSON.stringify(prev.groups) === JSON.stringify(next.groups);
});

type WcOddsSectionProps = {
  event: WcEventDetail;
  /** Одна колонка рынков — для узкой боковой панели (cybersport game page). */
  layout?: "default" | "stack";
};

function stackEntryPriority(name: string): number {
  if (is1X2Category(name)) return 0;
  if (/основ/i.test(name)) return 1;
  return 2;
}

export function WcOddsSection({ event, layout = "default" }: WcOddsSectionProps) {
  const { t } = useLocale();
  const isMobile = useWcMatchMobileLayout();
  const [allExpanded, setAllExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<WcMarketTabId>("all");
  const bettingOpen = useWcBettingOpen(event);

  const visibleEntries = useMemo(() => {
    const entries = Object.entries(event.groupedMarkets || {}) as Array<[string, WcMarketGroup[]]>;
    const prepared = entries
      .map(([name, groups]) => [
        name,
        deduplicateGroupsByOdds(
          filterDisplayableGroups(
            groups.filter((group) => isWcVisibleMarketKey(group.marketKey)),
          ),
        ),
      ] as [string, WcMarketGroup[]])
      .filter(([name, groups]) => groups.length > 0 && !isJunkMarketCategoryName(name));

    return filterFinalizedScopeMarketEntries(prepared, event);
  }, [event.groupedMarkets, event]);

  const marketTabs = useMemo(
    () => buildMarketTabs(visibleEntries, event.sport),
    [visibleEntries, event.sport],
  );

  useEffect(() => {
    setActiveTab("all");
  }, [event.id]);

  useEffect(() => {
    if (!marketTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("all");
    }
  }, [activeTab, marketTabs]);

  const categoryOptions = {
    sport: event.sport,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
  };

  const sortedEntries = useMemo(() => {
    const filtered = filterGroupedMarketsByTab(visibleEntries, activeTab);
    const regrouped = regroupEntriesForDisplay(filtered, activeTab);
    const expandedYesNo = expandYesNoLineCategories(regrouped);
    const expandedYesNoScoped = expandYesNoScopedCategories(expandedYesNo, {
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
    const expandedBundled = expandBundledYesNoCategories(expandedYesNoScoped);
    const expandedTimeWindows = expandTimeWindowYesNoCategories(expandedBundled);
    const expandedDoubleChance = expandDoubleChanceScopeCategories(expandedTimeWindows);
    const expandedWinner = expandWinnerScopeCategories(expandedDoubleChance);
    const expandedGoalsTeam = expandGoalsTeamCategories(expandedWinner);
    const expandedEvenOdd = expandEvenOddScopeCategories(expandedGoalsTeam);

    // Cyber sidebar: scopes render inside WcOddsItem — no extra accordion split.
    if (layout === "stack") {
      const merged = mergeEntriesByDisplayName(expandedEvenOdd, event.sport);
      return dedupeCyberMapCategoryEntries(merged);
    }

    return expandScopedMarketEntries(expandedEvenOdd, {
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      sport: event.sport,
    });
  }, [visibleEntries, activeTab, event.homeTeam, event.awayTeam, event.sport, layout]);

  const freshEntries = useWcFreshMarketEntries(sortedEntries, {
    enabled: event.phase === "live",
  });

  const scopeFilteredEntries = useMemo(
    () => filterFinalizedScopeMarketEntries(freshEntries, event),
    [freshEntries, event],
  );

  const orderedEntries = useMemo(() => {
    if (layout !== "stack") return scopeFilteredEntries;
    return [...scopeFilteredEntries].sort(
      (a, b) => stackEntryPriority(a[0]) - stackEntryPriority(b[0]),
    );
  }, [scopeFilteredEntries, layout]);

  const { pinnedEntries, regularEntries } = useMemo(() => {
    if (layout !== "stack") {
      return { pinnedEntries: [] as typeof orderedEntries, regularEntries: orderedEntries };
    }

    const pinned: typeof orderedEntries = [];
    const regular: typeof orderedEntries = [];

    for (const entry of orderedEntries) {
      if (isMainMatch1X2Category(entry[0], event.sport)) {
        pinned.push(entry);
      } else {
        regular.push(entry);
      }
    }

    return { pinnedEntries: pinned, regularEntries: regular };
  }, [orderedEntries, layout, event.sport]);

  const mergedEntries = useMemo(
    () => mergeEntriesByDisplayName(scopeFilteredEntries, event.sport),
    [scopeFilteredEntries, event.sport],
  );

  const rowBlocks = useMemo(() => {
    if (layout === "stack") {
      return regularEntries.length
        ? groupEntriesByCyberSection(regularEntries, event)
        : [];
    }
    return [];
  }, [regularEntries, layout, event]);

  const tabCounts = useMemo(
    () => (layout === "stack" ? countEntriesByTab(visibleEntries) : new Map<string, number>()),
    [visibleEntries, layout],
  );

  const categoryMeta = useMemo(() => {
    const map = new Map<string, { defaultFolded: boolean }>();
    freshEntries.forEach(([name, groups]) => {
      map.set(name, {
        defaultFolded:
          layout === "stack"
            ? shouldDefaultFoldCyberCategory(name, event)
            : isMobile && !isWcMobileDefaultOpenCategory(name, groups),
      });
    });
    return map;
  }, [freshEntries, isMobile, layout, event]);

  if (!Object.keys(event.groupedMarkets || {}).length) {
    return (
      <h3 className="py-4 font-medium text-center text-md">
        {t("wc.noMoreBets")}
      </h3>
    );
  }

  const isStack = layout === "stack";

  return (
    <>
      <div className={cn(isStack && matchStyles.oddsStickyHead)} data-cyber-odds-sticky-head={isStack || undefined}>
        <div className={matchStyles.TournamentOddsHeader}>
          <div className={matchStyles.oddMenuList}>
            {marketTabs.map((tab) => {
              const count =
                tab.id === "all"
                  ? visibleEntries.length
                  : tabCounts.get(tab.id) ?? 0;
              const rawLabel =
                tab.id === "all" ? t("wc.tabAll") : localizeWcLabel(tab.label, t);
              const compactLabel =
                isStack && tab.id !== "all"
                  ? formatCyberTabCompactLabel(rawLabel)
                  : rawLabel;
              const tabLabel =
                isStack && count > 0 ? `${compactLabel} (${count})` : compactLabel;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? matchStyles.activeButton : ""}
                  onClick={() => setActiveTab(tab.id)}
                  title={rawLabel}
                >
                  {tab.isFastEvents ? (
                    <FireIcon className={matchStyles.fireIcon} />
                  ) : null}
                  {tabLabel}
                </button>
              );
            })}
          </div>
          <div className={matchStyles.TournamentOddsHeaderButton} onClick={() => setAllExpanded((v) => !v)}>
            <Button>
              <ArrowTopIcon
                className={cn("transition-transform duration-300", {
                  "rotate-180": allExpanded,
                })}
              />
            </Button>
          </div>
        </div>

        {isStack && pinnedEntries.length > 0 ? (
          <div className={matchStyles.oddsPinnedBar} data-cyber-odds-pinned>
            {pinnedEntries.map(([name, groups]) => {
              const fullName = formatWcCategoryDisplayName(name, categoryOptions);
              const displayName = localizeWcLabel(fullName, t);
              return (
                <div className={matchStyles.oddsPinnedBlock} key={name}>
                  <p className={matchStyles.oddsPinnedLabel}>{displayName}</p>
                  <WcOddsItem
                    bettingOpen={bettingOpen}
                    categoryName={fullName}
                    event={event}
                    groups={groups}
                    kickChip
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {sortedEntries.length === 0 ? (
        <h3 className="py-4 font-medium text-center text-md">
          {t("wc.noMarketsInTab")}
        </h3>
      ) : freshEntries.length === 0 ? (
        <h3 className="py-4 font-medium text-center text-md text-slate-400">
          {t("wc.waitingMarkets")}
        </h3>
      ) : isStack ? (
        <div
          className={cn(matchStyles.oddsTables, matchStyles.oddsTables_stack)}
          data-odds-layout="stack"
        >
          <div className={matchStyles.oddsTable}>
            {rowBlocks.map((section) => (
              <div className={matchStyles.oddsCyberSection} data-cyber-section={section.id} key={section.id}>
                <div
                  className={matchStyles.oddsCyberSectionHead}
                  data-active={section.isActive || undefined}
                >
                  <span className={matchStyles.oddsCyberSectionLabel}>
                    {localizeWcLabel(section.label, t)}
                  </span>
                  {section.isActive ? (
                    <span className={matchStyles.oddsCyberSectionLive}>LIVE</span>
                  ) : null}
                </div>
                {section.entries.map(([name, groups]) => {
                  const meta = categoryMeta.get(name);
                  const fullName = formatWcCategoryDisplayName(name, categoryOptions);
                  const displayFull = localizeWcLabel(fullName, t);
                  const displayName = formatWcCategoryCompactName(displayFull);
                  return (
                    <WcOddsTable
                      bettingOpen={bettingOpen}
                      categoryName={fullName}
                      defaultFolded={meta?.defaultFolded ?? false}
                      event={event}
                      groups={groups}
                      isParentExpanded={allExpanded}
                      kickChip
                      key={name}
                      lazyMount={isMobile}
                      name={displayName}
                      title={displayName !== displayFull ? displayFull : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={matchStyles.oddsTablesBalanced}>
          <div className={matchStyles.oddsTableBalancedColumns}>
            {mergedEntries.map(([name, groups]) => {
              const meta = categoryMeta.get(name);
              const fullName = formatWcCategoryDisplayName(name, categoryOptions);
              return (
                <div className={matchStyles.oddsCategorySlot} key={name}>
                  <div className={matchStyles.oddsTable}>
                    <WcOddsTable
                      bettingOpen={bettingOpen}
                      categoryName={fullName}
                      defaultFolded={meta?.defaultFolded ?? false}
                      event={event}
                      groups={groups}
                      isParentExpanded={allExpanded}
                      lazyMount={isMobile}
                      name={localizeWcLabel(fullName, t)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
