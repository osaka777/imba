import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";

export type TotalsScopeOptions = {
  categoryName?: string;
  homeTeam?: string;
  awayTeam?: string;
  sport?: string;
};

export function isMainMatchTotalCategory(categoryName?: string): boolean {
  const category = categoryName?.trim() ?? "";
  if (!category) return false;
  if (/индивид/i.test(category)) return false;
  if (/чет/i.test(category) && /нечет/i.test(category)) return false;
  if (/\d+-[йи]\s+(тайм|сет)/i.test(category)) return false;
  if (/\d+-[яи]\s+четверть/i.test(category)) return false;

  if (category === "Тотал" || category === "Тотал (с ОТ)") return true;
  if (/^тотал (голов|раундов|геймов|очков)/i.test(category)) return true;

  return false;
}

/** Accordion title for the main match totals block (scope moves from row caption to header). */
export function getMainTotalsCategoryTitle(baseLabel: string, sport?: string): string {
  const otSuffix = /\(с\s*ОТ\)/i.test(baseLabel) ? " (с ОТ)" : "";
  const plain = baseLabel.replace(/\s*\(с\s*ОТ\)\s*/i, "").trim();
  if (plain !== "Тотал") return baseLabel;

  switch (sport) {
    case "mma":
      return `Тотал раундов${otSuffix}`;
    case "cyber-football":
      return `Тотал голов${otSuffix}`;
    case "cyber-basketball":
    case "basketball":
    case "volleyball":
    case "table-tennis":
      return `Тотал очков${otSuffix}`;
    case "tennis":
      return `Тотал геймов${otSuffix}`;
    default:
      return `Тотал голов${otSuffix}`;
  }
}

export function isScopeCaptionRedundant(categoryName?: string, scopeLabel?: string | null): boolean {
  if (!scopeLabel) return true;
  const category = categoryName?.trim() ?? "";
  if (!category) return false;
  if (category === scopeLabel) return true;
  if (isMainMatchTotalCategory(category)) return true;
  if (/·\s*(инд\.\s*тотал|тотал|фора)/i.test(category)) return true;
  if (/^\d+-[йи]\s+(сет|тайм)/i.test(category)) return true;
  return false;
}

function shouldHideMainMatchTotalScopeCaption(
  categoryName?: string,
  rawLabel?: string,
): boolean {
  if (!isMainMatchTotalCategory(categoryName)) return false;
  if (rawLabel && /\d+-[йи]\s+(тайм|сет|гейм)/i.test(rawLabel)) return false;
  if (rawLabel && /\d+-[яи]\s+четверть/i.test(rawLabel)) return false;
  return true;
}

function teamIndividualTotalsScope(
  group: WcMarketGroup,
  options?: TotalsScopeOptions,
): string | null {
  const category = options?.categoryName?.trim() ?? "";
  if (!/индивид|инд\.\s*тотал/i.test(category)) return null;

  const baseKey = normalizeWcMarketKey(group.marketKey);
  if (baseKey === "totals_home") {
    const team = options?.homeTeam?.trim() || "П1";
    return `${team} · инд. тотал`;
  }
  if (baseKey === "totals_away") {
    const team = options?.awayTeam?.trim() || "П2";
    return `${team} · инд. тотал`;
  }
  return null;
}

/** Strip trailing numeric line from a totals/handicap group label. */
export function stripLineFromGroupLabel(label: string): string {
  return label.replace(/\s*·?\s*-?[\d.,]+\s*$/, "").trim();
}

/**
 * Human-readable scope for totals rows (what is being counted).
 * Examples: "2-й сет · тотал геймов", "3-й гейм · тотал очков".
 */
export function formatTotalsScopeLabel(
  group: WcMarketGroup,
  categoryName?: string,
  options?: TotalsScopeOptions,
): string | null {
  const teamScope = teamIndividualTotalsScope(group, {
    categoryName,
    homeTeam: options?.homeTeam,
    awayTeam: options?.awayTeam,
  });
  if (teamScope) return teamScope;

  const raw = stripLineFromGroupLabel(group.label);
  if (!raw) return inferTotalsScopeFromCategory(categoryName);

  if (/тотал/i.test(raw)) {
    if (shouldHideMainMatchTotalScopeCaption(categoryName, raw)) {
      return null;
    }
    const normalized = raw
      .replace(/\s+/g, " ")
      .replace(/(\d+-[йи]\s+сет)\s+\1/gi, "$1")
      .trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  const setMatch = raw.match(/(\d+-[йи]\s+сет)/i);
  const gameMatch = raw.match(/(\d+-[йи]\s+гейм)/i);
  const halfMatch = raw.match(/(\d+-[йи]\s+тайм)/i);
  const quarterMatch = raw.match(/(\d+-[яи]\s+четверть)/i);

  if (gameMatch) {
    const parts = [setMatch?.[1], gameMatch[1]].filter(Boolean);
    return `${parts.join(", ")} · тотал очков`;
  }
  if (setMatch) return `${setMatch[1]} · тотал геймов`;
  if (halfMatch) return `${halfMatch[1]} · тотал голов`;
  if (quarterMatch) return `${quarterMatch[1]} · тотал очков`;

  if (/^\d+-[йи]\s+сет$/i.test(categoryName?.trim() ?? "")) {
    return `${categoryName!.trim()} · тотал геймов`;
  }

  return inferTotalsScopeFromCategory(categoryName);
}

function inferTotalsScopeFromCategory(categoryName?: string): string | null {
  const category = categoryName?.trim() ?? "";
  if (/^\d+-[йи]\s+сет$/i.test(category)) return `${category} · тотал геймов`;
  if (/^\d+-[йи]\s+тайм$/i.test(category)) return `${category} · тотал голов`;
  if (/^\d+-[яи]\s+четверть$/i.test(category)) return `${category} · тотал очков`;
  if (/^тотал/i.test(category) && !/чет/i.test(category)) {
    if (isMainMatchTotalCategory(category)) return null;
    return "Тотал голов в матче";
  }
  return null;
}

export function formatHandicapScopeLabel(
  group: WcMarketGroup,
  categoryName?: string,
  options?: TotalsScopeOptions,
): string | null {
  const scope = formatTotalsScopeLabel(group, categoryName, options);
  if (!scope) return null;
  return scope.replace(/тотал геймов/i, "фора по геймам").replace(/тотал очков/i, "фора по очкам").replace(/тотал голов/i, "фора");
}

/** Bucket key for grouping totals/handicap rows under the same scope header. */
export function totalsScopeBucketKey(
  group: WcMarketGroup,
  categoryName?: string,
  options?: TotalsScopeOptions,
): string {
  if (isMainMatchTotalCategory(categoryName)) {
    return `__match_total__${options?.sport ?? "default"}`;
  }
  return formatTotalsScopeLabel(group, categoryName, options) ?? group.label ?? group.key;
}
