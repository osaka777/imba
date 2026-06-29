"use client";

import type { ReactNode } from "react";

import type { WcEventDetail, WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";
import { findEvenOddPair } from "~/entities/wc-odds/lib/wcEvenOddPairs";
import { buildHandicapPairRows } from "~/entities/wc-odds/lib/wcHandicapPairs";
import {
  isWcAnyOffered,
  isWcOutcomeOffered,
  isWcPairOffered,
} from "~/entities/wc-odds/lib/wcMarketVisibility";
import { findTotalsPair, coalesceTotalsGroups, hasCompleteTotalsPair } from "~/entities/wc-odds/lib/wcTotalsPairs";
import { formatHandicapScopeLabel, formatTotalsScopeLabel, isScopeCaptionRedundant, totalsScopeBucketKey } from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { findPxOutcomes } from "~/entities/wc-odds/lib/wcPxOutcomes";
import { formatGroupSubLabel, needsGroupSubLabel } from "~/entities/wc-odds/lib/wcGroupSubLabel";
import {
  findYesNoOutcomes,
  filterRelevantTimeWindowGroups,
  isTimeWindowYesNoCategory,
  sortTimeWindowYesNoGroups,
  extractTimeWindowRange,
} from "~/entities/wc-odds/lib/wcYesNoTimeGroups";
import {
  isWcDisplayComboMarketKey,
  normalizeWcMarketKey,
} from "~/entities/wc-odds/lib/wcRate";
import { WcEvenOddPair } from "~/entities/wc-odds/ui/WcEvenOddPair";
import { WcHandicap3WayPivotRow } from "~/entities/wc-odds/ui/WcHandicap3WayPivotRow";
import { WcHandicapPair } from "~/entities/wc-odds/ui/WcHandicapPair";
import { WcPXPair } from "~/entities/wc-odds/ui/WcPXPair";
import { WcSingleBetRow } from "~/entities/wc-odds/ui/WcSingleBetRow";

import matchStyles from "~/entities/game/ui/Match/Match.module.css";
import { cn } from "~/shared/lib";

type WcOddsItemProps = {
  event: WcEventDetail;
  groups: WcMarketGroup[];
  categoryName: string;
  bettingOpen: boolean;
};

import { buildWcOutcomeButtonTitle } from "~/entities/wc-odds/lib/wcOutcomeDisplayTitle";
import {
  isCorrectScoreMarketKey,
  compareCorrectScoreOutcomes,
  sortCorrectScoreOutcomes,
} from "~/entities/wc-odds/lib/wcCorrectScoreSort";

function formatTotalsPoint(point: number | string): string {
  const num = typeof point === "number" ? point : Number.parseFloat(String(point));
  if (!Number.isFinite(num)) return String(point);
  if (Number.isInteger(num)) return String(num);
  return String(num);
}

function formatTotalsCellTitle(point: number | string, side: "М" | "Б"): string {
  return `${formatTotalsPoint(point)} ${side}`;
}

function isTrueH2hGroup(group: WcMarketGroup): boolean {
  return group.marketKey === "h2h";
}

function partitionGroups(groups: WcMarketGroup[]) {
  const h2h: WcMarketGroup[] = [];
  const doubleChance: WcMarketGroup[] = [];
  const totals: WcMarketGroup[] = [];
  const evenOdd: WcMarketGroup[] = [];
  const handicaps: WcMarketGroup[] = [];
  const handicap3way: WcMarketGroup[] = [];
  const yesNo: WcMarketGroup[] = [];
  const other: WcMarketGroup[] = [];

  for (const group of groups) {
    const key = normalizeWcMarketKey(group.marketKey);
    if (key === "h2h" && isTrueH2hGroup(group)) h2h.push(group);
    else if (key === "double_chance") doubleChance.push(group);
    else if (key === "totals" || key === "totals_home" || key === "totals_away") {
      if (isWcDisplayComboMarketKey(group.marketKey)) other.push(group);
      else totals.push(group);
    }
    else if (key === "even_odd") evenOdd.push(group);
    else if (key === "handicap") handicaps.push(group);
    else if (key === "handicap_3way") handicap3way.push(group);
    else if (key === "btts" || key === "goals_both_min") yesNo.push(group);
    else if (isDisplayYesNoGroup(group)) yesNo.push(group);
    else other.push(group);
  }

  return { h2h, doubleChance, totals, evenOdd, handicaps, handicap3way, yesNo, other };
}

function isDisplayYesNoGroup(group: WcMarketGroup): boolean {
  if (/DEUSE_POINT/i.test(group.marketKey) && group.outcomes.length === 2) return true;
  if (group.outcomes.length !== 2) return false;

  const keys = new Set(group.outcomes.map((outcome) => outcome.outcomeKey));
  if (keys.has("YES") && keys.has("NO")) return true;

  const names = group.outcomes.map((outcome) => outcome.name.trim().toLowerCase());
  return names.includes("да") && names.includes("нет");
}

function preferCanonicalH2hGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  const canonical = groups.filter((group) =>
    group.outcomes.some((o) => ["HOME", "DRAW", "AWAY"].includes(o.outcomeKey)),
  );
  if (!canonical.length) return groups.length > 1 ? groups.slice(0, 1) : groups;

  const threeWay = canonical.filter((group) =>
    group.outcomes.some((o) => o.outcomeKey === "DRAW"),
  );
  if (threeWay.length > 0) return threeWay.length > 1 ? threeWay.slice(0, 1) : threeWay;
  return canonical.length > 1 ? [canonical[0]!] : canonical;
}

function hasCanonicalDoubleChanceKeys(group: WcMarketGroup): boolean {
  return (
    group.outcomes.some((o) => o.outcomeKey === "DC_1X")
    && group.outcomes.some((o) => o.outcomeKey === "DC_12")
    && group.outcomes.some((o) => o.outcomeKey === "DC_X2")
  );
}

function preferCanonicalDoubleChanceGroups(groups: WcMarketGroup[]): WcMarketGroup[] {
  const canonical = groups.filter(
    (group) => group.marketKey === "double_chance" && hasCanonicalDoubleChanceKeys(group),
  );
  const scoped = groups.filter((group) => group !== canonical[0] && !hasCanonicalDoubleChanceKeys(group));
  if (canonical.length === 1 && scoped.length > 0 && groups.length > 1) {
    return [canonical[0]!, ...scoped];
  }
  return groups;
}

function isCorrectScoreCategoryName(categoryName: string): boolean {
  return /точн/i.test(categoryName);
}

function renderMergedCorrectScoreGroups(
  event: WcEventDetail,
  groups: WcMarketGroup[],
  categoryName: string,
  bettingOpen: boolean,
) {
  const items: Array<{ group: WcMarketGroup; outcome: WcMarketOutcome }> = [];

  for (const group of groups) {
    if (!isCorrectScoreMarketKey(group.marketKey)) continue;
    for (const outcome of group.outcomes) {
      if (isWcOutcomeOffered(outcome, group.marketKey, bettingOpen)) {
        items.push({ group, outcome });
      }
    }
  }

  if (!items.length) return null;

  items.sort((a, b) => compareCorrectScoreOutcomes(a.outcome, b.outcome));

  return (
    <div className={matchStyles.oddsBlockScoped}>
      <div className={cn(matchStyles.oddsBlock, matchStyles.oddsBlockCorrectScore)}>
        {items.map(({ group, outcome }) => (
          <WcSingleBetRow
            key={`${group.key}-${outcome.outcomeKey}`}
            event={event}
            group={group}
            outcome={outcome}
            title={buildWcOutcomeButtonTitle(group, outcome, categoryName)}
            bettingOpen={bettingOpen}
          />
        ))}
      </div>
    </div>
  );
}

function renderGroupSubLabel(group: WcMarketGroup, categoryName: string) {
  if (!needsGroupSubLabel(group, categoryName)) return null;

  return (
    <p className={matchStyles.oddsGroupSubLabel}>
      {formatGroupSubLabel(group, categoryName)}
    </p>
  );
}

function renderPxGroupOrRows(
  event: WcEventDetail,
  group: WcMarketGroup,
  categoryName: string,
  bettingOpen: boolean,
  is1X2 = false,
) {
  const px = findPxOutcomes(group);
  if (px) {
    if (!isWcAnyOffered([px.home, px.draw, px.away], group.marketKey, bettingOpen)) return null;

    return (
      <div key={group.key} className={matchStyles.oddsBlockScoped}>
        {renderGroupSubLabel(group, categoryName)}
        <div className={cn(matchStyles.oddsBlock, matchStyles.oddsBlockPX)}>
          <WcPXPair
            event={event}
            group={group}
            home={px.home}
            draw={px.draw}
            away={px.away}
            labels={px.labels}
            bettingOpen={bettingOpen}
          />
        </div>
      </div>
    );
  }

  const offered = group.outcomes.filter((outcome) =>
    isWcOutcomeOffered(outcome, group.marketKey, bettingOpen),
  );
  if (!offered.length) return null;

  const sortedOffered = isCorrectScoreMarketKey(group.marketKey)
    ? sortCorrectScoreOutcomes(offered)
    : offered;

  const isCorrectScore = isCorrectScoreMarketKey(group.marketKey);

  if (isCorrectScore) return null;

  return (
    <div key={group.key} className={matchStyles.oddsBlockScoped}>
      {renderGroupSubLabel(group, categoryName)}
      <div className={cn(matchStyles.oddsBlock, isCorrectScore && matchStyles.oddsBlockCorrectScore)}>
        {sortedOffered.map((outcome) => (
          <WcSingleBetRow
            key={`${group.key}-${outcome.outcomeKey}`}
            event={event}
            group={group}
            outcome={outcome}
            title={buildWcOutcomeButtonTitle(group, outcome, categoryName)}
            bettingOpen={bettingOpen}
            is1X2={is1X2}
          />
        ))}
      </div>
    </div>
  );
}

export function WcOddsItem({ event, groups, categoryName, bettingOpen }: WcOddsItemProps) {
  if (!groups.length) return null;

  if (isCorrectScoreCategoryName(categoryName)) {
    const mergedCorrectScore = renderMergedCorrectScoreGroups(event, groups, categoryName, bettingOpen);
    if (mergedCorrectScore) return mergedCorrectScore;
  }

  const { h2h: rawH2h, doubleChance: rawDoubleChance, totals, evenOdd, handicaps, handicap3way, yesNo, other } =
    partitionGroups(groups);

  const h2h = preferCanonicalH2hGroups(rawH2h);
  const doubleChance = preferCanonicalDoubleChanceGroups(rawDoubleChance);

  const scopeOptions = { homeTeam: event.homeTeam, awayTeam: event.awayTeam, sport: event.sport };

  const sortedTotals = coalesceTotalsGroups(totals).sort((a, b) => {
    const bucketA = totalsScopeBucketKey(a, categoryName, scopeOptions);
    const bucketB = totalsScopeBucketKey(b, categoryName, scopeOptions);
    if (bucketA !== bucketB) return bucketA.localeCompare(bucketB, "ru");
    const lineA = findTotalsPair(a).point ?? a.outcomes[0]?.point ?? 0;
    const lineB = findTotalsPair(b).point ?? b.outcomes[0]?.point ?? 0;
    return Number(lineA) - Number(lineB);
  });

  const completeTotals = sortedTotals.filter((group) => hasCompleteTotalsPair(group));
  const incompleteTotals = sortedTotals.filter((group) => !hasCompleteTotalsPair(group));

  const handicapRows = buildHandicapPairRows(handicaps);

  const handicapNodes = (() => {
    let lastBucket: string | null = null;

    return [
      ...handicapRows.flatMap((row) => {
        if (!isWcPairOffered(row.home, row.away, row.group.marketKey, bettingOpen)) return [];

        const bucket = formatHandicapScopeLabel(row.group, categoryName, scopeOptions) ?? row.group.label ?? row.key;
        const showScopeHeader = bucket !== lastBucket;
        lastBucket = bucket;

        return [
          <WcHandicapPair
            key={row.key}
            event={event}
            group={row.group}
            home={row.home}
            away={row.away}
            point={row.point}
            bettingOpen={bettingOpen}
            categoryName={categoryName}
            showScopeHeader={showScopeHeader}
          />,
        ];
      }),
      ...handicap3way.flatMap((group) => {
        const px = findPxOutcomes(group);
        if (!px?.draw) return [];

        if (!isWcPairOffered(px.home, px.away, group.marketKey, bettingOpen)) return [];

        return [
          <WcHandicap3WayPivotRow
            key={group.key}
            event={event}
            group={group}
            home={px.home}
            draw={px.draw}
            away={px.away}
            bettingOpen={bettingOpen}
          />,
        ];
      }),
    ];
  })();

  const totalsNodes = (() => {
    let lastBucket: string | null = null;

    return completeTotals.flatMap((group) => {
      const { under, over, point } = findTotalsPair(group);
      if (!hasCompleteTotalsPair(group)) return [];

      const bucket = formatTotalsScopeLabel(group, categoryName, scopeOptions);
      const bucketKey = totalsScopeBucketKey(group, categoryName, scopeOptions);
      const showScopeHeader = bucketKey !== lastBucket;
      lastBucket = bucketKey;

      const cells: ReactNode[] = [];

      if (under && isWcOutcomeOffered(under, group.marketKey, bettingOpen)) {
        cells.push(
          <WcSingleBetRow
            key={`${group.key}-under`}
            event={event}
            group={group}
            outcome={under}
            title={formatTotalsCellTitle(point, "М")}
            bettingOpen={bettingOpen}
          />,
        );
      }

      if (over && isWcOutcomeOffered(over, group.marketKey, bettingOpen)) {
        cells.push(
          <WcSingleBetRow
            key={`${group.key}-over`}
            event={event}
            group={group}
            outcome={over}
            title={formatTotalsCellTitle(point, "Б")}
            bettingOpen={bettingOpen}
          />,
        );
      }

      if (!cells.length) return [];

      return [
        <div key={group.key} className={showScopeHeader && bucket && !isScopeCaptionRedundant(categoryName, bucket) ? matchStyles.totalsScopedRow : undefined}>
          {showScopeHeader && bucket && !isScopeCaptionRedundant(categoryName, bucket) ? (
            <p className={matchStyles.totalsScopeCaption}>{bucket}</p>
          ) : null}
          <div className={matchStyles.oddsBlock}>{cells}</div>
        </div>,
      ];
    });
  })();

  const correctScoreGroups = other.filter((group) => isCorrectScoreMarketKey(group.marketKey));
  const otherWithoutCorrectScore = other.filter((group) => !isCorrectScoreMarketKey(group.marketKey));
  const extraOtherGroups = [...otherWithoutCorrectScore, ...incompleteTotals];

  return (
    <div className={matchStyles.oddsBlockCategory}>
      {h2h.map((group) => renderPxGroupOrRows(event, group, categoryName, bettingOpen, true))}

      {doubleChance.map((group) => renderPxGroupOrRows(event, group, categoryName, bettingOpen))}

      {totalsNodes.length > 0 ? (
        <div className={matchStyles.oddsTotalsGroup}>{totalsNodes}</div>
      ) : null}

      {evenOdd.map((group) => {
        const { even, odd } = findEvenOddPair(group);
        if (even && odd) {
          if (!isWcPairOffered(even, odd, group.marketKey, bettingOpen)) return null;

          return (
            <WcEvenOddPair
              key={group.key}
              event={event}
              group={group}
              even={even}
              odd={odd}
              bettingOpen={bettingOpen}
            />
          );
        }

        const offeredEvenOdd = group.outcomes.filter((outcome) =>
          isWcOutcomeOffered(outcome, group.marketKey, bettingOpen),
        );
        if (!offeredEvenOdd.length) return null;

        return (
          <div key={group.key} className={matchStyles.oddsBlock}>
            {offeredEvenOdd.map((outcome) => (
              <WcSingleBetRow
                key={`${group.key}-${outcome.outcomeKey}`}
                event={event}
                group={group}
                outcome={outcome}
                title={buildWcOutcomeButtonTitle(group, outcome, categoryName)}
                bettingOpen={bettingOpen}
              />
            ))}
          </div>
        );
      })}

      {handicapNodes.length > 0 ? (
        <div className={matchStyles.oddsTotalsGroup}>{handicapNodes}</div>
      ) : null}

      {handicaps
        .filter((group) => !handicapRows.some((row) => row.group.key === group.key))
        .map((group) => {
          const offered = group.outcomes.filter((outcome) =>
            isWcOutcomeOffered(outcome, group.marketKey, bettingOpen),
          );
          if (!offered.length) return null;

          return (
            <div key={group.key} className={matchStyles.oddsBlock}>
              {offered.map((outcome) => (
                <WcSingleBetRow
                  key={`${group.key}-${outcome.outcomeKey}`}
                  event={event}
                  group={group}
                  outcome={outcome}
                  title={buildWcOutcomeButtonTitle(group, outcome, categoryName)}
                  bettingOpen={bettingOpen}
                />
              ))}
            </div>
          );
        })}

      {handicap3way
        .filter((group) => {
          const px = findPxOutcomes(group);
          return !px?.draw;
        })
        .map((group) => renderPxGroupOrRows(event, group, categoryName, bettingOpen, true))}

      {(() => {
        const timeWindowYesNo = isTimeWindowYesNoCategory(categoryName, yesNo)
          ? sortTimeWindowYesNoGroups(filterRelevantTimeWindowGroups(yesNo, event))
          : [];
        const regularYesNo = timeWindowYesNo.length > 0
          ? yesNo.filter((group) => !timeWindowYesNo.includes(group))
          : yesNo;

        return (
          <>
            {timeWindowYesNo.length > 0 ? (
              <>
                {timeWindowYesNo.map((group) => {
                  const { yes, no } = findYesNoOutcomes(group);
                  const range = extractTimeWindowRange(group);
                  const intervalLabel = range
                    ? `${range.from}–${range.to} мин`
                    : group.label.replace(/^GOAL15MIN:\s*да\/нет\s*/i, "").trim();

                  return (
                    <div key={group.key} className={matchStyles.oddsBlockScoped}>
                      {intervalLabel ? (
                        <p className={matchStyles.oddsGroupSubLabel}>{intervalLabel}</p>
                      ) : null}
                      <div className={matchStyles.oddsBlock}>
                        {yes && isWcOutcomeOffered(yes, group.marketKey, bettingOpen) ? (
                          <WcSingleBetRow
                            key={`${group.key}-yes`}
                            event={event}
                            group={group}
                            outcome={yes}
                            title="Да"
                            bettingOpen={bettingOpen}
                          />
                        ) : null}
                        {no && isWcOutcomeOffered(no, group.marketKey, bettingOpen) ? (
                          <WcSingleBetRow
                            key={`${group.key}-no`}
                            event={event}
                            group={group}
                            outcome={no}
                            title="Нет"
                            bettingOpen={bettingOpen}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}

            {regularYesNo.map((group) => {
              const { yes, no } = findYesNoOutcomes(group);
              if (yes && no) {
                if (!isWcPairOffered(yes, no, group.marketKey, bettingOpen)) return null;

                return (
                  <div key={group.key} className={matchStyles.oddsBlockScoped}>
                    {renderGroupSubLabel(group, categoryName)}
                    <div className={matchStyles.oddsBlock}>
                      {isWcOutcomeOffered(yes, group.marketKey, bettingOpen) && (
                        <WcSingleBetRow
                          event={event}
                          group={group}
                          outcome={yes}
                          title={buildWcOutcomeButtonTitle(group, yes, categoryName)}
                          bettingOpen={bettingOpen}
                        />
                      )}
                      {isWcOutcomeOffered(no, group.marketKey, bettingOpen) && (
                        <WcSingleBetRow
                          event={event}
                          group={group}
                          outcome={no}
                          title={buildWcOutcomeButtonTitle(group, no, categoryName)}
                          bettingOpen={bettingOpen}
                        />
                      )}
                    </div>
                  </div>
                );
              }

              const offeredYesNo = group.outcomes.filter((outcome) =>
                isWcOutcomeOffered(outcome, group.marketKey, bettingOpen),
              );
              if (!offeredYesNo.length) return null;

              return (
                <div key={group.key} className={matchStyles.oddsBlock}>
                  {offeredYesNo.map((outcome) => (
                    <WcSingleBetRow
                      key={`${group.key}-${outcome.outcomeKey}`}
                      event={event}
                      group={group}
                      outcome={outcome}
                      title={buildWcOutcomeButtonTitle(group, outcome, categoryName)}
                      bettingOpen={bettingOpen}
                    />
                  ))}
                </div>
              );
            })}
          </>
        );
      })()}

      {correctScoreGroups.length > 0
        ? renderMergedCorrectScoreGroups(event, correctScoreGroups, categoryName, bettingOpen)
        : null}

      {extraOtherGroups.map((group) => renderPxGroupOrRows(event, group, categoryName, bettingOpen))}
    </div>
  );
}
