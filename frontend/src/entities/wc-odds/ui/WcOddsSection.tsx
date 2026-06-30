"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { ArrowIcon, ArrowTopIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import type { WcEventDetail, WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  buildMarketTabs,
  filterGroupedMarketsByTab,
  formatWcCategoryDisplayName,
  isWcMobileDefaultOpenCategory,
  packSmallGroups,
  regroupEntriesForDisplay,
  type WcMarketTabId,
} from "~/entities/wc-odds/lib/wcOddsCategories";
import { expandYesNoLineCategories } from "~/entities/wc-odds/lib/wcYesNoLineTitle";
import { expandTimeWindowYesNoCategories } from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import { expandScopedMarketEntries } from "~/entities/wc-odds/lib/wcScopedMarketSplit";
import { filterDisplayableGroups, deduplicateGroupsByOdds } from "~/entities/wc-odds/lib/wcMarketVisibility";
import { filterFinalizedScopeMarketEntries } from "~/entities/wc-odds/lib/wcScopeMarketFilter";
import { isWcVisibleMarketKey } from "~/entities/wc-odds/lib/wcRate";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import { useWcMatchMobileLayout } from "~/entities/wc-odds/lib/useWcMatchMobileLayout";
import { useWcFreshMarketEntries } from "~/entities/wc-odds/lib/useWcFreshMarketEntries";
import { WcOddsItem } from "~/entities/wc-odds/ui/WcOddsItem";
import FireIcon from "~/shared/assets/icons/fire.svg?component";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";

type WcOddsTableProps = {
  event: WcEventDetail;
  name: string;
  groups: WcMarketGroup[];
  isParentExpanded: boolean;
  bettingOpen: boolean;
  defaultFolded: boolean;
  lazyMount: boolean;
};

const WcOddsTable = memo(function WcOddsTable({
  event,
  name,
  groups,
  isParentExpanded,
  bettingOpen,
  defaultFolded,
  lazyMount,
}: WcOddsTableProps) {
  const [isFolded, setIsFolded] = useState(defaultFolded);

  useEffect(() => {
    setIsFolded(defaultFolded);
  }, [event.id, name, defaultFolded]);

  useEffect(() => {
    if (!isParentExpanded) {
      setIsFolded(true);
      return;
    }
    setIsFolded(defaultFolded);
  }, [isParentExpanded, defaultFolded]);

  const showContent = isParentExpanded && !isFolded;
  const mountContent = showContent || !lazyMount;

  if (!isParentExpanded) {
    return (
      <div>
        <Button className={matchStyles.oddFold} onClick={() => setIsFolded(false)}>
          <p className="text-sm font-medium text-white">{name}</p>
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
        type="button"
      >
        <p className="text-sm font-medium text-white">{name}</p>
        <ArrowIcon className={cn("size-3 fill-white transition-transform", !isFolded && "rotate-180")} />
      </Button>
      {mountContent ? (
        <div className={cn(matchStyles.oddsList, isFolded && matchStyles.oddsList_hidden)}>
          {showContent ? (
            <WcOddsItem
              event={event}
              groups={groups}
              categoryName={name}
              bettingOpen={bettingOpen}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}, (prev, next) => {
  if (prev.name !== next.name) return false;
  if (prev.bettingOpen !== next.bettingOpen) return false;
  if (prev.isParentExpanded !== next.isParentExpanded) return false;
  if (prev.defaultFolded !== next.defaultFolded) return false;
  if (prev.lazyMount !== next.lazyMount) return false;
  if (prev.event.id !== next.event.id) return false;
  if (prev.groups === next.groups) return true;
  return JSON.stringify(prev.groups) === JSON.stringify(next.groups);
});

type WcOddsSectionProps = {
  event: WcEventDetail;
};

export function WcOddsSection({ event }: WcOddsSectionProps) {
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
      .filter(([, groups]) => groups.length > 0);

    return filterFinalizedScopeMarketEntries(prepared, event);
  }, [event.groupedMarkets, event]);

  const marketTabs = useMemo(() => buildMarketTabs(visibleEntries), [visibleEntries]);

  useEffect(() => {
    setActiveTab("all");
  }, [event.id]);

  useEffect(() => {
    if (!marketTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("all");
    }
  }, [activeTab, marketTabs]);

  const sortedEntries = useMemo(() => {
    const filtered = filterGroupedMarketsByTab(visibleEntries, activeTab);
    const regrouped = regroupEntriesForDisplay(filtered, activeTab);
    const expandedYesNo = expandYesNoLineCategories(regrouped);
    const expandedTimeWindows = expandTimeWindowYesNoCategories(expandedYesNo);
    return expandScopedMarketEntries(expandedTimeWindows, {
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      sport: event.sport,
    });
  }, [visibleEntries, activeTab, event.homeTeam, event.awayTeam, event.sport]);

  const freshEntries = useWcFreshMarketEntries(sortedEntries, {
    enabled: event.phase === "live",
  });

  const scopeFilteredEntries = useMemo(
    () => filterFinalizedScopeMarketEntries(freshEntries, event),
    [freshEntries, event],
  );

  const rowBlocks = useMemo(
    () => packSmallGroups(scopeFilteredEntries, 15),
    [scopeFilteredEntries],
  );

  const categoryMeta = useMemo(() => {
    const map = new Map<string, { defaultFolded: boolean }>();
    freshEntries.forEach(([name, groups]) => {
      map.set(name, {
        defaultFolded: isMobile && !isWcMobileDefaultOpenCategory(name, groups),
      });
    });
    return map;
  }, [freshEntries, isMobile]);

  if (!Object.keys(event.groupedMarkets || {}).length) {
    return (
      <h3 className="py-4 font-medium text-center text-md">
        Ставок больше нет
      </h3>
    );
  }

  return (
    <>
      <div className={matchStyles.TournamentOddsHeader}>
        <div className={matchStyles.oddMenuList}>
          {marketTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? matchStyles.activeButton : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.isFastEvents ? (
                <FireIcon className={matchStyles.fireIcon} />
              ) : null}
              {tab.label}
            </button>
          ))}
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

      {sortedEntries.length === 0 ? (
        <h3 className="py-4 font-medium text-center text-md">
          Нет рынков в этой категории
        </h3>
      ) : freshEntries.length === 0 ? (
        <h3 className="py-4 font-medium text-center text-md text-slate-400">
          Ожидание обновления рынков…
        </h3>
      ) : (
        <div className={matchStyles.oddsTables}>
          {rowBlocks.map((row, rowIndex) => (
            <div className={matchStyles.oddsTable} key={rowIndex}>
              {row.map(([name, groups]) => {
                const meta = categoryMeta.get(name);
                return (
                  <WcOddsTable
                    key={name}
                    event={event}
                    name={formatWcCategoryDisplayName(name, event.sport)}
                    groups={groups}
                    isParentExpanded={allExpanded}
                    bettingOpen={bettingOpen}
                    defaultFolded={meta?.defaultFolded ?? false}
                    lazyMount={isMobile}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
