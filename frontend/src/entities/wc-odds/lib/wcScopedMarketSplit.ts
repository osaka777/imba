import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  formatHandicapScopeLabel,
  formatTotalsScopeLabel,
  getMainTotalsCategoryTitle,
  isMainMatchTotalCategory,
  totalsScopeBucketKey,
  type TotalsScopeOptions,
} from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { coalesceTotalsGroups } from "~/entities/wc-odds/lib/wcTotalsPairs";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function resolveTotalsBucketTitle(
  group: WcMarketGroup,
  blockName: string,
  options: TotalsScopeOptions,
): string {
  const scope = formatTotalsScopeLabel(group, blockName, options);
  if (scope) return scope;
  if (isMainMatchTotalCategory(blockName)) {
    return getMainTotalsCategoryTitle(blockName, options.sport);
  }
  return blockName;
}

function splitTotalsBlock(
  blockName: string,
  groups: WcMarketGroup[],
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  const totalsGroups = coalesceTotalsGroups(
    groups.filter((group) => {
      const key = normalizeWcMarketKey(group.marketKey);
      return key === "totals" || key === "totals_home" || key === "totals_away";
    }),
  );

  if (!totalsGroups.length) return [[blockName, groups]];

  const otherGroups = groups.filter(
    (group) => !totalsGroups.some((item) => item.key === group.key),
  );

  const buckets = new Map<string, WcMarketGroup[]>();
  const titles = new Map<string, string>();

  for (const group of totalsGroups) {
    const key = totalsScopeBucketKey(group, blockName, options);
    titles.set(key, resolveTotalsBucketTitle(group, blockName, options));
    const existing = buckets.get(key) ?? [];
    buckets.set(key, [...existing, group]);
  }

  const alwaysSplit = /^индивидуальный тотал/i.test(blockName);
  if (!alwaysSplit && buckets.size <= 1) return [[blockName, groups]];

  const split = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([key, bucketGroups]) => [titles.get(key) ?? blockName, bucketGroups] as [string, WcMarketGroup[]]);

  if (otherGroups.length && split.length > 0) {
    split[0][1] = [...split[0][1], ...otherGroups];
  } else if (otherGroups.length) {
    split.push([blockName, otherGroups]);
  }

  return split;
}

function splitHandicapBlock(
  blockName: string,
  groups: WcMarketGroup[],
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  const buckets = new Map<string, WcMarketGroup[]>();
  const titles = new Map<string, string>();

  for (const group of groups) {
    const scope = formatHandicapScopeLabel(group, blockName, options);
    const bucketKey = scope ?? blockName;
    titles.set(bucketKey, scope ?? blockName);

    const existing = buckets.get(bucketKey) ?? [];
    if (!existing.some((item) => item.key === group.key)) {
      buckets.set(bucketKey, [...existing, group]);
    }
  }

  if (buckets.size <= 1) {
    const onlyKey = [...buckets.keys()][0];
    if (!onlyKey || onlyKey === blockName) return [[blockName, groups]];
    return [[titles.get(onlyKey) ?? blockName, buckets.get(onlyKey)!]];
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([key, bucketGroups]) => [titles.get(key) ?? blockName, bucketGroups]);
}

/** Split merged totals/handicap blocks into separate accordion categories per scope. */
export function expandScopedMarketEntries(
  entries: Array<[string, WcMarketGroup[]]>,
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [blockName, groups] of entries) {
    if (/^индивидуальный тотал/i.test(blockName)) {
      result.push(...splitTotalsBlock(blockName, groups, options));
      continue;
    }

    if (/^тотал/i.test(blockName) && !/чет/i.test(blockName)) {
      const split = splitTotalsBlock(blockName, groups, options);
      result.push(...(split.length > 1 ? split : [[blockName, groups]]));
      continue;
    }

    if (/^фора/i.test(blockName)) {
      result.push(...splitHandicapBlock(blockName, groups, options));
      continue;
    }

    result.push([blockName, groups]);
  }

  return result;
}
