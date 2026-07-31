/**
 * Normalize Olimpbet virtual category names into readable accordion titles and tab scopes.
 * Fixes awkward labels like «Очки в тай-брейке 2-й сет» across tennis, volleyball, etc.
 */

export type NormalizedCategory = {
  /** Short market title without trailing scope noise. */
  display: string;
  /** Period tab: set / half / quarter / map / tiebreak. */
  tabScope: string | null;
  /** Accordion title when scope matters (e.g. «2-й сет · Тай-брейк»). */
  scopedDisplay: string;
  /** Stable merge key for deduplicating split buckets. */
  mergeKey: string;
};

const SET_RE = /(\d+)\s*[-–—]?\s*[йи]\s+сет/i;
const HALF_RE = /(\d+)\s*[-–—]?\s*[йи]\s+тайм/i;
const QUARTER_RE = /(\d+)\s*[-–—]?\s*[яи]\s+четверть/i;
const GAME_RE = /(\d+)\s*[-–—]?\s*[йи]\s+гейм/i;
const MAP_RE = /(\d+)\s*[-–—]?\s*[йяи]\s+карт[аыеу]?/i;
const ROUND_RE = /(\d+)\s*[-–—]?\s*[йи]\s+раунд/i;

function formatSet(n: string): string {
  return `${n}-й сет`;
}

function formatHalf(n: string): string {
  return `${n}-й тайм`;
}

function formatQuarter(n: string): string {
  return `${n}-я четверть`;
}

function formatGame(n: string): string {
  return `${n}-й гейм`;
}

function formatMap(n: string): string {
  return `${n}-я карта`;
}

function formatRound(n: string): string {
  return `${n}-й раунд`;
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripTrailingScope(name: string): string {
  let s = normalizeSpaces(name);
  s = s.replace(/\s*[,·•]\s*\d+\s*[-–—]?\s*[йи]\s+гейм.*$/i, "");
  s = s.replace(/\s*[,·•]\s*\d+\s*[-–—]?\s*[йи]\s+сет.*$/i, "");
  s = s.replace(/\s*[,·•]\s*\d+\s*[-–—]?\s*[йи]\s+тайм.*$/i, "");
  s = s.replace(/\s*[,·•]\s*\d+\s*[-–—]?\s*[яи]\s+четверть.*$/i, "");
  s = s.replace(/\s*[,·•]\s*\d+\s*[-–—]?\s*[йяи]\s+карт[аыеу]?.*$/i, "");
  s = s.replace(/\s+в\s+\d+\s*[-–—]?\s*[йяи]\s+карт[аыеу]?.*$/i, "");
  s = s.replace(/\s+\d+\s*[-–—]?\s*[йи]\s+сет\s*$/i, "");
  s = s.replace(/\s+\d+\s*[-–—]?\s*[йи]\s+тайм\s*$/i, "");
  s = s.replace(/\s+\d+\s*[-–—]?\s*[яи]\s+четверть\s*$/i, "");
  s = s.replace(/\s+\d+\s*[-–—]?\s*[йи]\s+гейм\s*$/i, "");
  s = s.replace(/\s+\d+\s*[-–—]?\s*[йяи]\s+карт[аыеу]?\s*$/i, "");
  return normalizeSpaces(s.replace(/^[,·•]\s*|[,·•]\s*$/g, ""));
}

function parseScope(name: string): {
  set?: string;
  half?: string;
  quarter?: string;
  game?: string;
  map?: string;
  round?: string;
} {
  const scope: ReturnType<typeof parseScope> = {};
  const set = name.match(SET_RE);
  if (set) scope.set = formatSet(set[1]!);
  const half = name.match(HALF_RE);
  if (half) scope.half = formatHalf(half[1]!);
  const quarter = name.match(QUARTER_RE);
  if (quarter) scope.quarter = formatQuarter(quarter[1]!);
  const game = name.match(GAME_RE);
  if (game) scope.game = formatGame(game[1]!);
  const map = name.match(MAP_RE);
  if (map) scope.map = formatMap(map[1]!);
  const round = name.match(ROUND_RE);
  if (round) scope.round = formatRound(round[1]!);
  return scope;
}

function pickTabScope(scope: ReturnType<typeof parseScope>, raw: string): string | null {
  if (scope.set) return scope.set;
  if (scope.half) return scope.half;
  if (scope.quarter) return scope.quarter;
  if (scope.map) return scope.map;
  if (/^тай-?брейк$/i.test(raw.trim())) return "Тай-брейк";
  if (/тай-?брейк/i.test(raw) && !scope.set && !scope.half) return "Тай-брейк";
  return null;
}

function canonicalMarketTitle(name: string): string {
  const trimmed = normalizeSpaces(name);
  const lower = trimmed.toLowerCase();

  if (/^очки\s+в\s+тай-?брейке$/i.test(trimmed)) return "Тай-брейк";
  if (/^очки\s+в\s+тай-?брейке/i.test(trimmed)) return "Тай-брейк";
  if (/^тай-?брейк/i.test(trimmed) && !/очки/i.test(trimmed)) return "Тай-брейк";

  if (/^score_set$/i.test(trimmed) || /^сч[её]т\s+в\s+гейме$/i.test(trimmed)) return "Счёт в гейме";
  if (/^score_first_x_games/i.test(trimmed)) return "Счёт первых геймов";
  if (/^score_map$/i.test(trimmed) || /^сч[её]т\s+в\s+\d/i.test(trimmed) || /^сч[её]т\s+на\s+карт/i.test(trimmed)) {
    return "Точный счёт";
  }
  if (/^score$/i.test(trimmed) || /^сч[её]т$/i.test(trimmed)) return "Точный счёт";
  if (/^следующ.*очк.*гейм/i.test(trimmed)) return "Следующее очко";
  if (/^next_points_game$/i.test(trimmed)) return "Следующее очко";

  if (/^race_to_point_game$/i.test(trimmed) || /^гонка\s+по\s+очкам/i.test(trimmed)) {
    return "Гонка по очкам";
  }
  if (/^race_to_game$/i.test(trimmed) || /^гонка\s+(до|по)\s+/i.test(trimmed)) {
    return trimmed.replace(/^гонка\s+по\s+геймам/i, "Гонка по геймам");
  }

  if (/^exact_point_game_set$/i.test(trimmed) || /точн.*очк.*гейм/i.test(trimmed)) {
    return "Точное число очков в гейме";
  }
  if (/^winner_game$/i.test(trimmed) || /^победа\s+в\s+гейме$/i.test(trimmed)) return "Исход гейма";
  if (/^winner_2games_set/i.test(trimmed) || /исход\s+двух\s+геймов/i.test(trimmed)) {
    return "Исход двух геймов";
  }
  if (/^deuse_point$/i.test(trimmed) || lower === "40:40" || lower === "дьюс") return "40:40";

  if (/^multiscore/i.test(trimmed) || /мультисч[её]т/i.test(trimmed)) return "Мультисчёт сета";

  if (/^total\s+rounds$/i.test(trimmed) || /^тотал\s+раундов$/i.test(trimmed)) return "Тотал раундов";
  if (/^winner_round$/i.test(trimmed) || /^исход\s+раунда$/i.test(trimmed)) return "Исход раунда";
  if (/^winner_map$/i.test(trimmed) || /^победа\s+на\s+карт/i.test(trimmed)) return "Победа на карте";

  if (/^score_first_x_games/i.test(trimmed)) return "Счёт первых геймов";

  if (/^(\d+-[йи]\s+сет)\s*[,·•]\s*(.+)$/i.test(trimmed)) {
    const m = /^(\d+-[йи]\s+сет)\s*[,·•]\s*(.+)$/i.exec(trimmed);
    if (m) return canonicalMarketTitle(m[2]!);
  }

  if (/^(.+?)\s+(\d+-[йи]\s+сет)$/i.test(trimmed)) {
    return canonicalMarketTitle(stripTrailingScope(trimmed));
  }

  const stripped = stripTrailingScope(trimmed);
  if (/^сч[её]т$/i.test(stripped) || /^score$/i.test(stripped)) return "Точный счёт";
  return stripped;
}

function buildScopedDisplay(display: string, tabScope: string | null, game?: string): string {
  if (!tabScope) return display;
  if (tabScope === display) return display;

  const scopePrefix = `${tabScope.toLowerCase()} ·`;
  if (display.toLowerCase().startsWith(scopePrefix) || display.toLowerCase() === tabScope.toLowerCase()) {
    return game && !display.includes(game) ? `${display} · ${game}` : display;
  }

  if (game && !display.includes(game)) return `${tabScope} · ${display} · ${game}`;
  return `${tabScope} · ${display}`;
}

/** Normalize raw groupedMarkets category key from Olimpbet. */
export function normalizeScopedCategoryName(raw: string): NormalizedCategory {
  const trimmed = normalizeSpaces(raw);
  if (!trimmed) {
    return { display: trimmed, tabScope: null, scopedDisplay: trimmed, mergeKey: trimmed.toLowerCase() };
  }

  const scope = parseScope(trimmed);
  const display = canonicalMarketTitle(trimmed);
  const tabScope = pickTabScope(scope, trimmed);
  const scopedDisplay = buildScopedDisplay(display, tabScope, scope.game);
  const mergeKey = `${tabScope ?? ""}|${display}${scope.game ? `|${scope.game}` : ""}`.toLowerCase();

  return { display, tabScope, scopedDisplay, mergeKey };
}

/** Tab key derived from normalized scope (set / half / quarter / map). */
export function deriveNormalizedTabScope(name: string): string | null {
  return normalizeScopedCategoryName(name).tabScope;
}
