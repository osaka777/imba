import type { WcMarketGroup } from "~/entities/wc-odds/api/client";
import { normalizeWcMarketKey } from "~/entities/wc-odds/lib/wcRate";
import { resolveHalfMatchHtFtLabel } from "~/entities/wc-odds/lib/wcGroupSubLabel";

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
  if (/\d+-[яи]\s+(четверть|половин)/i.test(category)) return false;

  if (category === "Тотал" || category === "Тотал (с ОТ)") return true;
  if (/^тотал (голов|раундов|геймов|очков)/i.test(category)) return true;

  return false;
}

/** Main match totals label by sport (goals / rounds / maps / games). */
export function esportsTotalsUnitLabel(sport?: string): string | null {
  if (!sport?.startsWith("esports.")) return null;
  if (sport === "esports.cs" || sport === "esports.csgo" || sport === "esports.valorant" || sport === "esports.dota2") {
    return "карт";
  }
  return "карт";
}

/** Match/period totals unit word by sport slug. */
export function periodTotalsUnitForSport(sport?: string): string {
  switch (sport) {
    case "mma":
      return "раундов";
    case "cyber-basketball":
    case "basketball":
    case "volleyball":
    case "table-tennis":
      return "очков";
    case "tennis":
      return "геймов";
    case "esports.cs":
    case "esports.csgo":
    case "esports.valorant":
    case "esports.dota2":
      return "карт";
    default:
      if (sport?.startsWith("esports.")) return "карт";
      return "голов";
  }
}

/** Olimpbet-style title: soccer uses plain "Тотал", other sports keep the unit. */
export function totalsTitleForUnit(unit: string): string {
  if (unit === "голов") return "Тотал";
  return `Тотал ${unit}`;
}

function totalsScopePhraseForUnit(unit: string): string {
  if (unit === "голов") return "тотал";
  return `тотал ${unit}`;
}

function normalizeTotalsUnitLabel(label: string, sport?: string, categoryName?: string): string {
  if (/тотал\s+раунд/i.test(label)) return label;
  const esportsUnit = esportsTotalsUnitLabel(sport);
  if (esportsUnit) {
    return label
      .replace(/тотал\s+голов/gi, `тотал ${esportsUnit}`)
      .replace(/Тотал\s+голов/g, `Тотал ${esportsUnit}`);
  }

  const statUnit = totalsUnitFromStatCategory(categoryName);
  if (statUnit) {
    return label
      .replace(/Тотал\s+(голов|очков|геймов|угловых|фолов|аутов|офсайдов|ударов(?:\s+в\s+створ|\s+от\s+ворот|\s+по\s+воротам)?|жёлтых\s+карточек|желтых\s+карточек)/gi, `Тотал ${statUnit}`)
      .replace(/тотал\s+(голов|очков|геймов|угловых|фолов|аутов|офсайдов|ударов(?:\s+в\s+створ|\s+от\s+ворот|\s+по\s+воротам)?|жёлтых\s+карточек|желтых\s+карточек)/gi, `тотал ${statUnit}`);
  }

  // Soccer/hockey: strip "голов" → plain Тотал like Olimpbet.
  const unit = periodTotalsUnitForSport(sport);
  if (unit === "голов") {
    return label
      .replace(/Тотал\s+голов/g, "Тотал")
      .replace(/тотал\s+голов/gi, "тотал");
  }

  // Fix wrong parser labels on period scopes for non-goal sports.
  if (!/тайм|половин|четверть/i.test(label)) return label;
  return label
    .replace(/Тотал\s+(голов|очков|геймов)/g, totalsTitleForUnit(unit))
    .replace(/тотал\s+(голов|очков|геймов)/gi, totalsScopePhraseForUnit(unit));
}

/** Genitive unit for linked stat tabs (corners/fouls/…), mirroring backend parser. */
export function totalsUnitFromStatCategory(categoryName?: string): string | null {
  const name = categoryName?.trim().toLowerCase() ?? "";
  if (!name) return null;

  if (/^углов/.test(name)) return "угловых";
  if (/^желт/.test(name)) return "жёлтых карточек";
  if (/^фол/.test(name)) return "фолов";
  if (/^офсайд/.test(name)) return "офсайдов";
  if (/^аут/.test(name)) return "аутов";
  if (/удар.*створ/.test(name)) return "ударов в створ";
  if (/удар.*от\s+ворот/.test(name)) return "ударов от ворот";
  if (/удар.*по\s+ворот|^удары$/.test(name)) return "ударов";
  if (/штанг|перекладин/.test(name)) return "штанг";
  if (/^сейв/.test(name)) return "сейвов";
  if (/^замен/.test(name)) return "замен";
  if (/видеопросмотр|var/i.test(name)) return "видеопросмотров";
  if (/^перехват/.test(name)) return "перехватов";
  if (/успешн.*обвод/.test(name)) return "успешных обводок";
  if (/успешн.*отбор/.test(name)) return "успешных отборов";
  if (/%\s*точн|точн.*передач/.test(name)) return "точных передач";
  if (/касани.*вратар/.test(name)) return "касаний мяча вратарём";
  if (/ожидаем|xg/i.test(name)) return "ожидаемых голов (xG)";
  if (/верхов|единоборств/.test(name)) return "верховых единоборств";
  if (/мед\.?\s*бригад|медицин/.test(name)) return "выходов мед.бригады";
  if (/^эйс/.test(name)) return "эйсов";
  if (/двойн.*ошиб/.test(name)) return "двойных ошибок";
  if (/^брейк/.test(name)) return "брейков";

  return null;
}

/** Accordion title for the main match totals block (scope moves from row caption to header). */
export function getMainTotalsCategoryTitle(baseLabel: string, sport?: string): string {
  const otSuffix = /\(с\s*ОТ\)/i.test(baseLabel) ? " (с ОТ)" : "";
  const plain = baseLabel.replace(/\s*\(с\s*ОТ\)\s*/i, "").trim();
  if (plain !== "Тотал") return normalizeTotalsUnitLabel(baseLabel, sport);

  const unit = periodTotalsUnitForSport(sport);
  // Soccer/hockey: plain "Тотал" like Olimpbet (not "Тотал голов").
  const titled = unit === "голов" ? "Тотал"
    : unit === "очков" ? "Тотал очков"
    : unit === "геймов" ? "Тотал геймов"
    : unit === "раундов" ? "Тотал раундов"
    : unit === "карт" ? "Тотал карт"
    : `Тотал ${unit}`;
  return `${titled}${otSuffix}`;
}

export function isScopeCaptionRedundant(categoryName?: string, scopeLabel?: string | null): boolean {
  if (!scopeLabel) return true;
  const category = categoryName?.trim() ?? "";
  if (!category) return false;
  if (category === scopeLabel) return true;
  if (isMainMatchTotalCategory(category)) return true;
  if (/·\s*(инд\.\s*тотал|тотал|фора)/i.test(category)) return true;
  if (/^\d+-[йи]\s+(сет|тайм)/i.test(category)) return true;
  if (/^\d+-[яи]\s+(четверть|половин)/i.test(category)) return true;
  return false;
}

function shouldHideMainMatchTotalScopeCaption(
  categoryName?: string,
  rawLabel?: string,
): boolean {
  if (!isMainMatchTotalCategory(categoryName)) return false;
  if (rawLabel && /\d+-[йи]\s+(тайм|сет|гейм)/i.test(rawLabel)) return false;
  if (rawLabel && /\d+-[яи]\s+(четверть|половин)/i.test(rawLabel)) return false;
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
  const trimmed = label.trim();
  if (/^[\d.,]+$/.test(trimmed)) return trimmed;
  return trimmed.replace(/\s*·\s*(-?[\d]+[.,][\d]+)\s*$/i, "").trim();
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
  const htFtLabel = resolveHalfMatchHtFtLabel(group.marketKey, {
    homeTeam: options?.homeTeam,
    awayTeam: options?.awayTeam,
  });
  if (htFtLabel) {
    // Category already split to «Арг/Исп · тотал» — don't repeat the HT/FT caption.
    if (categoryName && categoryName.includes(htFtLabel)) return null;
    return htFtLabel;
  }

  const teamScope = teamIndividualTotalsScope(group, {
    categoryName,
    homeTeam: options?.homeTeam,
    awayTeam: options?.awayTeam,
  });
  if (teamScope) return teamScope;

  const raw = stripLineFromGroupLabel(group.label);
  if (!raw) return inferTotalsScopeFromCategory(categoryName, options?.sport);

  if (/тотал/i.test(raw)) {
    if (shouldHideMainMatchTotalScopeCaption(categoryName, raw)) {
      return null;
    }
    const normalized = raw
      .replace(/\s+/g, " ")
      .replace(/(\d+-[йи]\s+сет)\s+\1/gi, "$1")
      .trim();
    const withSportUnit = normalizeTotalsUnitLabel(normalized, options?.sport, categoryName);
    return withSportUnit.charAt(0).toUpperCase() + withSportUnit.slice(1);
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
  if (halfMatch) {
    const unit = totalsUnitFromStatCategory(categoryName)
      ?? periodTotalsUnitForSport(options?.sport);
    return `${halfMatch[1]} · ${totalsScopePhraseForUnit(unit)}`;
  }
  if (quarterMatch) {
    const unit = totalsUnitFromStatCategory(categoryName)
      ?? periodTotalsUnitForSport(options?.sport);
    return `${quarterMatch[1]} · ${totalsScopePhraseForUnit(unit)}`;
  }

  if (/^\d+-[йи]\s+сет$/i.test(categoryName?.trim() ?? "")) {
    return `${categoryName!.trim()} · тотал геймов`;
  }

  return inferTotalsScopeFromCategory(categoryName, options?.sport);
}

function inferTotalsScopeFromCategory(categoryName?: string, sport?: string): string | null {
  const category = categoryName?.trim() ?? "";
  const statUnit = totalsUnitFromStatCategory(category);
  const unit = statUnit ?? periodTotalsUnitForSport(sport);
  if (/^\d+-[йи]\s+сет$/i.test(category)) return `${category} · тотал геймов`;
  if (/^\d+-[йи]\s+тайм$/i.test(category)) return `${category} · ${totalsScopePhraseForUnit(unit)}`;
  if (/^\d+-[яи]\s+(четверть|половин)/i.test(category)) return `${category} · ${totalsScopePhraseForUnit(unit)}`;
  if (statUnit) return `Тотал ${statUnit}`;
  if (/^тотал/i.test(category) && !/чет/i.test(category)) {
    if (isMainMatchTotalCategory(category)) return null;
    const matchUnit = esportsTotalsUnitLabel(sport) ?? unit;
    return `${totalsTitleForUnit(matchUnit)} в матче`;
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
  return scope
    .replace(/тотал геймов/i, "фора по геймам")
    .replace(/тотал очков/i, "фора по очкам")
    .replace(/тотал карт/i, "фора по картам")
    .replace(/тотал голов/i, "фора");
}

/** Bucket key for grouping totals/handicap rows under the same scope header. */
export function totalsScopeBucketKey(
  group: WcMarketGroup,
  categoryName?: string,
  options?: TotalsScopeOptions,
): string {
  const htFtLabel = resolveHalfMatchHtFtLabel(group.marketKey, {
    homeTeam: options?.homeTeam,
    awayTeam: options?.awayTeam,
  });
  if (htFtLabel) {
    return `half_match|${htFtLabel}|${categoryName?.trim() ?? ""}`;
  }

  if (isMainMatchTotalCategory(categoryName)) {
    return `__match_total__${options?.sport ?? "default"}`;
  }
  const scope = formatTotalsScopeLabel(group, categoryName, options);
  if (scope) return scope;

  const label = group.label?.trim() ?? "";
  if (label && !/^(12|1x|x2|п1|п2|x)$/i.test(label)) {
    return label;
  }

  return group.key;
}
