import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import {
  formatHandicapScopeLabel,
  formatTotalsScopeLabel,
  getMainTotalsCategoryTitle,
  isMainMatchTotalCategory,
  isScopeCaptionRedundant,
  stripLineFromGroupLabel,
  totalsScopeBucketKey,
  type TotalsScopeOptions,
} from "~/entities/wc-odds/lib/wcMarketScopeLabel";
import { formatGroupSubLabel, needsGroupSubLabel } from "~/entities/wc-odds/lib/wcGroupSubLabel";
import { coalesceTotalsGroups } from "~/entities/wc-odds/lib/wcTotalsPairs";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

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

/** Category title for a group that would otherwise show a black sub-header. */
export function resolveGroupDisplayCategory(
  group: WcMarketGroup,
  blockName: string,
  options: TotalsScopeOptions,
): string | null {
  const label = group.label?.trim() ?? "";
  const block = blockName.trim();

  if (needsGroupSubLabel(group, block)) {
    return formatGroupSubLabel(group, block);
  }

  const baseKey = normalizeWcMarketKey(group.marketKey);
  if (baseKey === "totals" || baseKey === "totals_home" || baseKey === "totals_away") {
    const scope = formatTotalsScopeLabel(group, block, options);
    if (scope && !isScopeCaptionRedundant(block, scope)) return scope;
    const stripped = stripLineFromGroupLabel(label);
    if (stripped && /тотал/i.test(stripped) && normalizeLabel(stripped) !== normalizeLabel(block)) {
      return stripped;
    }
  }

  if (baseKey === "handicap" || baseKey === "handicap_3way") {
    const scope = formatHandicapScopeLabel(group, block, options);
    if (scope && !isScopeCaptionRedundant(block, scope) && normalizeLabel(scope) !== normalizeLabel(block)) {
      return scope;
    }
    const stripped = stripLineFromGroupLabel(label);
    if (stripped && /(фора|гандикап)/i.test(stripped) && normalizeLabel(stripped) !== normalizeLabel(block)) {
      return stripped;
    }
  }

  if (
    label
    && normalizeLabel(label) !== normalizeLabel(block)
    && !block.toLowerCase().includes(label.toLowerCase())
  ) {
    if (/^display_/i.test(group.marketKey) && /[,·]|гонка\s+до|\d+-[йи]\s+(сет|гейм|тайм)/i.test(label)) {
      return label;
    }
  }

  return null;
}

function splitBlockByGroupScope(
  blockName: string,
  groups: WcMarketGroup[],
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  const buckets = new Map<string, WcMarketGroup[]>();
  const unsplit: WcMarketGroup[] = [];

  for (const group of groups) {
    const categoryName = resolveGroupDisplayCategory(group, blockName, options);
    if (categoryName) {
      const existing = buckets.get(categoryName) ?? [];
      if (!existing.some((item) => item.key === group.key)) {
        buckets.set(categoryName, [...existing, group]);
      }
    } else {
      unsplit.push(group);
    }
  }

  if (buckets.size === 0) return [[blockName, groups]];

  const result: Array<[string, WcMarketGroup[]]> = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([name, bucketGroups]) => [name, bucketGroups]);

  if (unsplit.length) {
    result.push([blockName, unsplit]);
  }

  return result;
}

function shouldSplitBlockByGroupScope(
  blockName: string,
  groups: WcMarketGroup[],
  options: TotalsScopeOptions,
): boolean {
  if (/^\d+-[йи]\s+(сет|тайм)/i.test(blockName)) return true;
  if (/^Следующее очко|^40:40$/i.test(blockName)) return true;
  if (groups.some((group) => resolveGroupDisplayCategory(group, blockName, options) != null)) {
    return true;
  }
  return false;
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

function expandCanonicalScopedBlock(
  blockName: string,
  groups: WcMarketGroup[],
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  if (/^индивидуальный тотал/i.test(blockName)) {
    return splitTotalsBlock(blockName, groups, options);
  }

  if (/^тотал/i.test(blockName) && !/чет/i.test(blockName)) {
    const split = splitTotalsBlock(blockName, groups, options);
    return split.length > 1 ? split : [[blockName, groups]];
  }

  if (/^фора/i.test(blockName)) {
    return splitHandicapBlock(blockName, groups, options);
  }

  return [[blockName, groups]];
}

/** Split merged blocks into separate accordion categories (black sub-headers → blue headers). */
export function expandScopedMarketEntries(
  entries: Array<[string, WcMarketGroup[]]>,
  options: TotalsScopeOptions,
): Array<[string, WcMarketGroup[]]> {
  const result: Array<[string, WcMarketGroup[]]> = [];

  for (const [blockName, groups] of entries) {
    if (shouldSplitBlockByGroupScope(blockName, groups, options)) {
      const byScope = splitBlockByGroupScope(blockName, groups, options);
      for (const [name, bucket] of byScope) {
        result.push(...expandCanonicalScopedBlock(name, bucket, options));
      }
      continue;
    }

    result.push(...expandCanonicalScopedBlock(blockName, groups, options));
  }

  return result;
}
