"use client";

import { useEffect, useMemo, useState } from "react";

import { ArrowIcon, ArrowTopIcon } from "~/shared/assets";
import { cn } from "~/shared/lib";
import { Button } from "~/shared/ui";
import type { WcEventDetail, WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  buildMarketTabs,
  filterGroupedMarketsByTab,
  humanizeWcCategoryName,
  formatWcCategoryDisplayName,
  regroupEntriesForDisplay,
  type WcMarketTabId,
} from "~/entities/wc-odds/lib/wcOddsCategories";
import { expandYesNoLineCategories } from "~/entities/wc-odds/lib/wcYesNoLineTitle";
import { expandScopedMarketEntries } from "~/entities/wc-odds/lib/wcScopedMarketSplit";
import { filterOfferedGroups } from "~/entities/wc-odds/lib/wcMarketVisibility";
import { isWcVisibleMarketKey } from "~/entities/wc-odds/lib/wcRate";
import { useWcBettingOpen } from "~/entities/wc-odds/lib/useWcBettingOpen";
import { WcOddsItem } from "~/entities/wc-odds/ui/WcOddsItem";
import FireIcon from "~/shared/assets/icons/fire.svg?component";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";

function packSmallGroups<T>(
  items: [string, T][],
  maxGroupSize = 1000,
): Array<Array<[string, T]>> {
  const result: Array<Array<[string, T]>> = [];

  if (items.length <= maxGroupSize && items.length > 1) {
    const mid = Math.ceil(items.length / 2);
    result.push(items.slice(0, mid));
    result.push(items.slice(mid));
    return result;
  }

  for (let i = 0; i < items.length; i += maxGroupSize) {
    result.push(items.slice(i, i + maxGroupSize));
  }

  return result;
}

type WcOddsTableProps = {
  event: WcEventDetail;
  name: string;
  groups: WcMarketGroup[];
  isParentExpanded: boolean;
  bettingOpen: boolean;
};

function WcOddsTable({ event, name, groups, isParentExpanded, bettingOpen }: WcOddsTableProps) {
  const [isFolded, setIsFolded] = useState(false);

  useEffect(() => {
    setIsFolded(!isParentExpanded);
  }, [isParentExpanded]);

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
      <Button className={matchStyles.oddFold} onClick={() => setIsFolded((v) => !v)}>
        <p className="text-sm font-medium text-white">{name}</p>
        <ArrowIcon className={cn("size-3 fill-white transition-transform", !isFolded && "rotate-180")} />
      </Button>
      <div className={cn(matchStyles.oddsList, isFolded && matchStyles.oddsList_hidden)}>
        <WcOddsItem
          event={event}
          groups={groups}
          categoryName={name}
          bettingOpen={bettingOpen}
        />
      </div>
    </div>
  );
}

type WcOddsSectionProps = {
  event: WcEventDetail;
};

export function WcOddsSection({ event }: WcOddsSectionProps) {
  const [allExpanded, setAllExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<WcMarketTabId>("all");
  const bettingOpen = useWcBettingOpen(event);

  const visibleEntries = useMemo(() => {
    const entries = Object.entries(event.groupedMarkets || {}) as Array<[string, WcMarketGroup[]]>;
    return entries
      .map(([name, groups]) => [
        name,
        filterOfferedGroups(
          groups.filter((group) => isWcVisibleMarketKey(group.marketKey)),
          bettingOpen,
        ),
      ] as [string, WcMarketGroup[]])
      .filter(([, groups]) => groups.length > 0);
  }, [event.groupedMarkets, bettingOpen]);

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
    return expandScopedMarketEntries(expandedYesNo, {
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      sport: event.sport,
    });
  }, [visibleEntries, activeTab, event.homeTeam, event.awayTeam, event.sport]);

  const rowBlocks = useMemo(
    () => packSmallGroups(sortedEntries, 15),
    [sortedEntries],
  );

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
      ) : (
        <div className={matchStyles.oddsTables}>
          {rowBlocks.map((row, rowIndex) => (
            <div className={matchStyles.oddsTable} key={rowIndex}>
              {row.map(([name, groups]) => (
                <WcOddsTable
                  key={name}
                  event={event}
                  name={formatWcCategoryDisplayName(name, event.sport)}
                  groups={groups}
                  isParentExpanded={allExpanded}
                  bettingOpen={bettingOpen}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
