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
import { formatEvenOddScopeLabel } from "~/entities/wc-odds/lib/wcEvenOddScope";
import { formatGroupSubLabel, needsGroupSubLabel, resolveComboVariantGroupLabel, halfMatchHtFtSortIndex } from "~/entities/wc-odds/lib/wcGroupSubLabel";
import { resolveYesNoScopedAccordionTitle } from "~/entities/wc-odds/lib/wcYesNoLineTitle";
import { coalesceTotalsGroups } from "~/entities/wc-odds/lib/wcTotalsPairs";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const SHORT_COMBO_SCOPE = /^(12|1x|x2|п1|п2|x)$/i;

function isStatScopeBlock(blockName: string): boolean {
  return /^(угловые|фолы|офсайды|желт|жёлт|карточ|удары|эйсы|брейки|двойные ошибки)/i.test(blockName.trim());
}

function formatEvenOddSplitTitle(title: string, blockName: string): string {
  const trimmed = title.trim();
  if (/^(п1|п2|1x|x2|12|x)$/i.test(trimmed)) {
    return `${trimmed} · Тотал (Чет/Нечет)`;
  }
  if (/чет/i.test(trimmed) && /нечет/i.test(trimmed)) {
    if (isStatScopeBlock(blockName) && !trimmed.toLowerCase().includes(blockName.trim().toLowerCase())) {
      return `${blockName} · ${trimmed}`;
    }
    return trimmed;
  }
  if (isStatScopeBlock(blockName)) return `${blockName} · Тотал (Чет/Нечет)`;
  return trimmed;
}

function isTotalsMarketKey(marketKey: string): boolean {
  const key = normalizeWcMarketKey(marketKey);
  return key === "totals" || key === "totals_home" || key === "totals_away";
}

function formatScopedSplitTitle(
  title: string,
  groups: WcMarketGroup[],
  blockName: string,
  options: TotalsScopeOptions,
): string {
  const trimmed = title.trim();
  const sample = groups[0];

  if (sample && groups.every((group) => isTotalsMarketKey(group.marketKey))) {
    const scope = formatTotalsScopeLabel(sample, blockName, options);
    if (scope) return scope;
    if (isMainMatchTotalCategory(blockName)) {
      return getMainTotalsCategoryTitle(blockName, options.sport);
    }
    if (/^тотал/i.test(blockName)) return blockName;
  }

  if (SHORT_COMBO_SCOPE.test(trimmed) && sample) {
    if (groups.every((group) => isTotalsMarketKey(group.marketKey))) {
      const scope = formatTotalsScopeLabel(sample, blockName, options);
      if (scope) return scope;
      if (isMainMatchTotalCategory(blockName)) {
        return getMainTotalsCategoryTitle(blockName, options.sport);
      }
      if (/^тотал/i.test(blockName)) return blockName;
    }

    const combo = resolveComboVariantGroupLabel(sample.marketKey, options, sample.label);
    if (combo && combo !== trimmed) return combo;
    if (/двойной\s+шанс/i.test(blockName)) {
      return `${trimmed} · тотал`;
    }
    if (/результат/i.test(blockName) || /AND_TOTAL/i.test(sample.marketKey)) {
      return `Результат + тотал · ${trimmed}`;
    }
  }

  if (sample && groups.every((group) => normalizeWcMarketKey(group.marketKey) === "even_odd")) {
    return formatEvenOddSplitTitle(trimmed, blockName);
  }

  if (/чет/i.test(trimmed) && /нечет/i.test(trimmed)) {
    return formatEvenOddSplitTitle(trimmed, blockName);
  }

  return title;
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

  const yesNoScope = resolveYesNoScopedAccordionTitle(block, group, options);
  if (yesNoScope && normalizeLabel(yesNoScope) !== normalizeLabel(block)) {
    return yesNoScope;
  }

  if (needsGroupSubLabel(group, block, options)) {
    const sub = formatGroupSubLabel(group, block, options);
    if (SHORT_COMBO_SCOPE.test(sub) && isTotalsMarketKey(group.marketKey)) {
      return null;
    }
    return sub;
  }

  const baseKey = normalizeWcMarketKey(group.marketKey);
  if (baseKey === "totals" || baseKey === "totals_home" || baseKey === "totals_away") {
    const scope = formatTotalsScopeLabel(group, block, options);
    if (scope && !isScopeCaptionRedundant(block, scope)) return scope;
    // Period tabs ("1-й тайм"): promote sport-correct scope to accordion title.
    if (
      scope
      && (/^\d+-[йи]\s+(сет|тайм)/i.test(block) || /^\d+-[яи]\s+(четверть|половин)/i.test(block))
    ) {
      return scope;
    }
    const stripped = stripLineFromGroupLabel(label);
    if (stripped && /тотал/i.test(stripped) && normalizeLabel(stripped) !== normalizeLabel(block)) {
      return formatTotalsScopeLabel({ ...group, label: stripped }, block, options) ?? stripped;
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

  if (baseKey === "even_odd") {
    const scope = formatEvenOddScopeLabel(group, block);
    if (scope && normalizeLabel(scope) !== normalizeLabel(block)) {
      return scope;
    }
    if (isStatScopeBlock(block) || /^\d+-[йи]\s+тайм$/i.test(block)) {
      return "Тотал (Чет/Нечет)";
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

  const compareSplitTitles = (a: string, aGroups: WcMarketGroup[], b: string, bGroups: WcMarketGroup[]) => {
    const ia = halfMatchHtFtSortIndex(aGroups[0]?.marketKey ?? "");
    const ib = halfMatchHtFtSortIndex(bGroups[0]?.marketKey ?? "");
    if (ia !== 99 || ib !== 99) {
      if (ia !== ib) return ia - ib;
    }
    return a.localeCompare(b, "ru");
  };

  const result: Array<[string, WcMarketGroup[]]> = [...buckets.entries()]
    .sort(([a, aGroups], [b, bGroups]) => compareSplitTitles(a, aGroups, b, bGroups))
    .map(([name, bucketGroups]) => [
      formatScopedSplitTitle(name, bucketGroups, blockName, options),
      bucketGroups,
    ]);

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
  if (isStatScopeBlock(blockName) || /^(угловые|фолы|офсайды|желт|карточ|удары|эйсы|брейки|двойные ошибки)\s*,/i.test(blockName)) {
    return true;
  }
  if (/^Следующее очко|^40:40$/i.test(blockName)) return true;
  if (groups.some((group) => resolveGroupDisplayCategory(group, blockName, options) != null)) {
    return true;
  }
  return false;
}

function isAsianTotalsLine(group: WcMarketGroup): boolean {
  if (/азиатск/i.test(group.label)) return true;
  return group.outcomes.some((outcome) => {
    if (outcome.point == null) return false;
    const frac = Math.abs(Number(outcome.point) % 1);
    return Math.abs(frac - 0.25) < 0.001 || Math.abs(frac - 0.75) < 0.001;
  });
}

function isThreeWayTotalsGroup(group: WcMarketGroup): boolean {
  if (/3\s*исход/i.test(group.label)) return true;
  return group.outcomes.filter((o) => Number.isFinite(o.price) && o.price > 1).length >= 3;
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

  // Plain «Тотал» must not contain asian quarter-lines (0.75/1.25…) or 3-way rows —
  // they look like basketball junk on soccer when wrongly folded in.
  const isPlainMatchTotal =
    /^тотал$/i.test(blockName.trim())
    || /^тотал\s*\(с\s*от\)$/i.test(blockName.trim());

  let workingTotals = totalsGroups;
  const peeled: Array<[string, WcMarketGroup[]]> = [];
  if (isPlainMatchTotal) {
    const asian = totalsGroups.filter(isAsianTotalsLine);
    const threeWay = totalsGroups.filter(
      (group) => !isAsianTotalsLine(group) && isThreeWayTotalsGroup(group),
    );
    workingTotals = totalsGroups.filter(
      (group) => !isAsianTotalsLine(group) && !isThreeWayTotalsGroup(group),
    );
    if (asian.length) peeled.push(["Азиатский тотал", asian]);
    if (threeWay.length) peeled.push(["Тотал (3 исхода)", threeWay]);
  }

  const buckets = new Map<string, WcMarketGroup[]>();
  const titles = new Map<string, string>();

  for (const group of workingTotals) {
    const key = totalsScopeBucketKey(group, blockName, options);
    titles.set(key, resolveTotalsBucketTitle(group, blockName, options));
    const existing = buckets.get(key) ?? [];
    buckets.set(key, [...existing, group]);
  }

  const alwaysSplit = /^индивидуальный тотал/i.test(blockName);
  if (!alwaysSplit && buckets.size <= 1 && peeled.length === 0) {
    return [[blockName, groups]];
  }

  const split = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([key, bucketGroups]) => [titles.get(key) ?? blockName, bucketGroups] as [string, WcMarketGroup[]]);

  if (otherGroups.length && split.length > 0) {
    split[0][1] = [...split[0][1], ...otherGroups];
  } else if (otherGroups.length) {
    split.push([blockName, otherGroups]);
  }

  // If peeling left main empty but we still have asian/3-way, keep a main slot only when needed.
  if (split.length === 0 && peeled.length > 0 && otherGroups.length === 0) {
    return peeled;
  }

  return [...split, ...peeled];
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
