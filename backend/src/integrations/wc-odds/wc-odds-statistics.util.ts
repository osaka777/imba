import type { OlimpbetEventDetail } from '../olimpbet-wc/olimpbet-wc.types';
import {
  formatTennisGameScoreDisplay,
  isTennisGameStartScore,
} from './tennis-game-score.util';
import {
  getTennisCurrentSetIndex,
  getTennisSetGames,
} from './wc-match-state-tracker.util';
import { tennisGameKey, type WcMatchState } from './wc-match-state.types';

import { parseScorePair } from '../olimpbet-wc/olimpbet-event-result.util';

import {
  applyOlimpbetFeedExtras,
  extractOlimpbetFeedExtras,
} from './olimpbet-feed-fields.util';

import type {
  OlimpbetInlineStat,
  OlimpbetStructuredStatistics,
  OlimpbetTeamStatistics,
  WcEventStatsPayload,
  WcParsedScore,
  WcStatListItem,
} from './wc-odds-statistics.types';

const PERIOD_SPORTS = new Set([
  'soccer',
  'hockey',
  'basketball',
  'cyber-football',
  'cyber-basketball',
]);
const SET_SPORTS = new Set(['tennis', 'table-tennis', 'volleyball']);

function isSoccerLikeSport(sport: string): boolean {
  return sport === 'soccer' || sport === 'cyber-football';
}

function isPeriodClockSport(sport: string): boolean {
  return (
    isSoccerLikeSport(sport)
    || sport === 'hockey'
    || sport === 'basketball'
    || sport === 'cyber-basketball'
  );
}

/** Sportradar/Olimpbet `match_phase` — active period or break after period N (3X). */
export function decodeSportradarMatchPhase(phase: string | null | undefined): {
  period?: number;
  breakPhase?: boolean;
} {
  if (!phase) return {};
  const trimmed = phase.trim();
  if (!trimmed) return {};

  if (/^[1-9]$/.test(trimmed)) {
    return { period: Number(trimmed) };
  }

  if (/^3[0-9]$/.test(trimmed)) {
    const digit = Number(trimmed[1]);
    if (digit >= 1) return { period: digit, breakPhase: true };
  }

  if (trimmed === '301') return { period: 1, breakPhase: true };
  if (trimmed === '302') return { period: 2, breakPhase: true };
  if (trimmed === '40') return { period: 4 };

  return {};
}

export function resolvePeriodSportPeriod(
  sport: string,
  matchPhase: string | null,
  detailsLength = 0,
): number | undefined {
  if (!matchPhase) return undefined;

  if (isSoccerLikeSport(sport)) {
    const resolved = resolveSoccerPeriod(matchPhase);
    return resolved != null ? Number(resolved) : undefined;
  }

  if (isPeriodClockSport(sport) && sport !== 'soccer' && sport !== 'cyber-football') {
    const decoded = decodeSportradarMatchPhase(matchPhase);
    if (decoded.period == null) {
      return detailsLength > 0 ? detailsLength : undefined;
    }

    if (decoded.breakPhase && detailsLength > decoded.period) {
      return detailsLength;
    }

    return decoded.period;
  }

  const n = Number(matchPhase);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function resolvePeriodSportGamePhase(
  sport: string,
  matchPhase: string | null,
  detailsLength = 0,
): SoccerGamePhase {
  if (isSoccerLikeSport(sport)) return resolveSoccerGamePhaseFromMatchPhase(matchPhase);

  if (isPeriodClockSport(sport) && sport !== 'soccer' && sport !== 'cyber-football') {
    const decoded = decodeSportradarMatchPhase(matchPhase);
    if (!decoded.breakPhase) return null;
    if (detailsLength > 0 && decoded.period != null && decoded.period < detailsLength) {
      return null;
    }
    return 'break';
  }

  return null;
}

/** Sportradar match_status codes (Olimpbet inline `match_phase`). */
const SR_SOCCER_PERIOD: Record<string, number> = {
  '6': 1,   // FIRST_HALF
  '31': 1,  // HALFTIME (still 1st half context)
  '7': 2,   // SECOND_HALF
  '32': 3,  // AWAITING_OT
  '41': 3,  // FIRST_HALF_OT
  '33': 3,  // OT_HALFTIME
  '42': 4,  // SECOND_HALF_OT
  '34': 5,  // AWAITING_PENALTIES
  '50': 5,  // PENALTY_SHOOTING
};

/** Legacy Olimpbet phase codes (older feeds). */
const LEGACY_SOCCER_PERIOD: Record<string, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
};

/** Olimpbet/Sportradar soccer match_phase → human period number (1 = 1st half, 2 = 2nd half, etc.) */
function resolveSoccerPeriod(matchPhase: string | null): string | number | undefined {
  if (!matchPhase) return undefined;
  if (SR_SOCCER_PERIOD[matchPhase] != null) return SR_SOCCER_PERIOD[matchPhase];
  if (LEGACY_SOCCER_PERIOD[matchPhase] != null) return LEGACY_SOCCER_PERIOD[matchPhase];
  return undefined;
}

import type { SoccerGamePhase } from './wc-soccer-phase.util';
import {
  applySoccerPhaseRefinement,
  refineSoccerGamePhase,
  resolveSoccerGamePhaseFromMatchPhase,
} from './wc-soccer-phase.util';

const SOCCER_FIRST_HALF_PHASES = new Set(['3', '6']);
const SOCCER_SECOND_HALF_PHASES = new Set(['4', '7']);
const SOCCER_BREAK_PHASES = new Set(['8', '9', '31', '32', '33', '34']);

/** Seconds beyond the normal period duration → extra/stoppage time minutes to display */
function calcSoccerExtraTime(
  timeStr: string | null,
  matchPhase: string | null,
): number | null {
  const cleaned = stripPeriodFromClock(timeStr);
  if (!cleaned || !matchPhase) return null;
  if (SOCCER_BREAK_PHASES.has(matchPhase)) return null;

  const match = cleaned.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const totalSec = Number(match[1]) * 60 + Number(match[2]);

  // Extra time / penalties — no stoppage clock
  if (['5', '41', '42', '50'].includes(matchPhase)) return null;

  if (SOCCER_FIRST_HALF_PHASES.has(matchPhase) && totalSec > 45 * 60) {
    return Math.floor((totalSec - 45 * 60) / 60);
  }
  if (SOCCER_SECOND_HALF_PHASES.has(matchPhase) && totalSec > 90 * 60) {
    return Math.floor((totalSec - 90 * 60) / 60);
  }
  return null;
}

function inlineStat(stats: OlimpbetInlineStat[] | null | undefined, code: string): string | null {
  const row = (stats ?? []).find((s) => s.code === code);
  const value = row?.value;
  return value != null && String(value).trim() !== '' ? String(value).trim() : null;
}

function stripPeriodFromClock(time: string | null): string | null {
  if (!time) return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/\s*[-·]\s*[TТ]\d+.*$/i, '')
    .replace(/\s*[·]\s*\d+\s*[ТT]?\d*.*$/i, '')
    .trim() || null;
}

function timeToSeconds(time: string | null): number | undefined {
  const cleaned = stripPeriodFromClock(time);
  if (!cleaned) return undefined;
  const match = cleaned.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parsePeriodPairs(raw: string | null): [string | number, string | number][] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((chunk) => chunk.trim())
    .map((chunk) => parseScorePair(chunk.replace(/\s/g, '')))
    .filter((pair): pair is { home: number; away: number } => pair != null)
    .map((pair) => [pair.home, pair.away] as [string | number, string | number]);
}

function setsWonFromDetails(details: [string | number, string | number][]): [number, number] {
  let home = 0;
  let away = 0;
  for (const [h, a] of details) {
    const hn = Number(h);
    const an = Number(a);
    if (!Number.isFinite(hn) || !Number.isFinite(an)) continue;
    if (hn > an) home += 1;
    else if (an > hn) away += 1;
  }
  return [home, away];
}

function periodScoresFromStructured(
  home?: OlimpbetTeamStatistics | null,
  away?: OlimpbetTeamStatistics | null,
): [string | number, string | number][] {
  const homePeriods = home?.periodScores ?? [];
  const awayPeriods = away?.periodScores ?? [];
  const maxLen = Math.max(homePeriods.length, awayPeriods.length);
  const rows: [string | number, string | number][] = [];

  for (let i = 0; i < maxLen; i += 1) {
    const h = homePeriods[i]?.score ?? home?.periodStats?.[i]?.score ?? '-';
    const a = awayPeriods[i]?.score ?? away?.periodStats?.[i]?.score ?? '-';
    rows.push([h, a]);
  }

  return rows;
}

function addStatRow(
  list: WcStatListItem[],
  id: string,
  name: string,
  home: number | string | null | undefined,
  away: number | string | null | undefined,
) {
  if (home == null && away == null) return;
  if (home === 0 && away === 0 && id !== 'red_cards' && id !== 'yellow_cards') {
    // keep zero rows for cards only
  }
  const h = home ?? 0;
  const a = away ?? 0;
  if (h === 0 && a === 0 && !['red_cards', 'yellow_cards', 'yellow_red_cards'].includes(id)) {
    return;
  }
  list.push({
    id,
    name,
    opp1: String(h),
    opp2: String(a),
  });
}

function buildSoccerStatList(
  inline: OlimpbetInlineStat[] | null | undefined,
  structured?: OlimpbetStructuredStatistics | null,
): WcStatListItem[] {
  const home = structured?.homeStatistics ?? null;
  const away = structured?.awayStatistics ?? null;
  const list: WcStatListItem[] = [];

  const redHome = Number(inlineStat(inline, 'team1_red_cards') ?? home?.redCards ?? 0);
  const redAway = Number(inlineStat(inline, 'team2_red_cards') ?? away?.redCards ?? 0);

  addStatRow(list, 'corners', 'Угловые', home?.corners, away?.corners);
  addStatRow(list, 'yellow_cards', 'Жёлтые карточки', home?.yellowCards, away?.yellowCards);
  addStatRow(list, 'red_cards', 'Красные карточки', redHome, redAway);
  addStatRow(list, 'yellow_red_cards', 'Жёлто-красные', home?.yellowRedCards, away?.yellowRedCards);
  addStatRow(list, 'shots_on', 'Удары в створ', home?.shotsOnTarget, away?.shotsOnTarget);
  addStatRow(list, 'shots_off', 'Удары мимо', home?.shotsOffTarget, away?.shotsOffTarget);
  addStatRow(list, 'offsides', 'Офсайды', home?.offsides, away?.offsides);
  addStatRow(list, 'fouls', 'Фолы', home?.fouls, away?.fouls);
  addStatRow(list, 'dangerous_attacks', 'Опасные атаки', home?.dangerousAttacks, away?.dangerousAttacks);
  addStatRow(list, 'substitutions', 'Замены', home?.substitutions, away?.substitutions);
  addStatRow(list, 'free_kicks', 'Штрафные', home?.freeKicks, away?.freeKicks);
  addStatRow(list, 'penalty_score', 'Пенальти', home?.penaltyScore, away?.penaltyScore);
  addStatRow(list, 'extra_time_score', 'Голы в доп. время', home?.extraTimeScore, away?.extraTimeScore);

  const possession = structured?.commonStatistics?.possession;
  if (typeof possession === 'number' && possession >= 0 && possession <= 100) {
    const homePoss = Math.round(possession);
    const awayPoss = 100 - homePoss;
    list.push({ id: 'possession', name: 'Владение мячом', opp1: `${homePoss}`, opp2: `${awayPoss}` });
  }

  return list;
}

function buildTennisStatList(
  inline: OlimpbetInlineStat[] | null | undefined,
  structured?: OlimpbetStructuredStatistics | null,
): WcStatListItem[] {
  const list: WcStatListItem[] = [];
  const home = structured?.homeStatistics ?? null;
  const away = structured?.awayStatistics ?? null;

  addStatRow(list, 'aces', 'Эйсы', home?.aces, away?.aces);
  addStatRow(list, 'double_faults', 'Двойные ошибки', home?.doubleFaults, away?.doubleFaults);

  const server = inlineStat(inline, 'current_server');
  if (server === '1' || server === '2') {
    list.push({
      id: 'server',
      name: 'Подача',
      opp1: server === '1' ? '●' : '○',
      opp2: server === '2' ? '●' : '○',
    });
  }

  return list;
}

function buildParsedScore(
  sport: string,
  inline: OlimpbetInlineStat[] | null | undefined,
  structured?: OlimpbetStructuredStatistics | null,
): WcParsedScore | null {
  const scoreRaw =
    inlineStat(inline, 'score')
    ?? (structured?.homeStatistics?.score != null && structured?.awayStatistics?.score != null
      ? `${structured.homeStatistics.score}:${structured.awayStatistics.score}`
      : null);

  if (!scoreRaw && !inlineStat(inline, 'scores_by_periods')) return null;

  const parsedMain = parseScorePair(scoreRaw);
  const periodDetails = parsePeriodPairs(inlineStat(inline, 'scores_by_periods'));
  const structuredDetails = periodScoresFromStructured(
    structured?.homeStatistics,
    structured?.awayStatistics,
  );
  const details = periodDetails.length > 0 ? periodDetails : structuredDetails;

  const currentTime = inlineStat(inline, 'current_time');
  const remainingTime = inlineStat(inline, 'remaining_time');
  const timerRaw = currentTime ?? remainingTime;
  const timer = stripPeriodFromClock(timerRaw);
  const gameScore = inlineStat(inline, 'game_score');
  const matchPhase = inlineStat(inline, 'match_phase');
  const server = inlineStat(inline, 'current_server');

  const parsed: WcParsedScore = {};

  if (SET_SPORTS.has(sport)) {
    const setsFromScore = parseScorePair(scoreRaw);
    const setsFromDetails = details.length > 0 ? setsWonFromDetails(details) : null;
    const currentScore: [string | number, string | number] = setsFromScore
      ? [setsFromScore.home, setsFromScore.away]
      : setsFromDetails
        ? setsFromDetails
        : ['-', '-'];

    parsed.currentScore = currentScore;
    const displayGameScore =
      sport === 'tennis' || sport === 'table-tennis'
        ? formatTennisGameScoreDisplay(gameScore) ?? gameScore ?? undefined
        : gameScore ?? undefined;
    parsed.text = {
      currentScore: scoreRaw ?? `${currentScore[0]}:${currentScore[1]}`,
      liveScore: displayGameScore,
      time: timer ?? undefined,
    };
    parsed.seconds = timeToSeconds(timer ?? null);
    parsed.details = details.length > 0 ? details : undefined;
    if (server === '1' || server === '2') {
      parsed.liveScore = { active: Number(server) };
    }
    if (matchPhase) parsed.period = matchPhase;
    applyOlimpbetFeedExtras(
      parsed,
      extractOlimpbetFeedExtras(inline, structured?.commonStatistics, {
        includeAnnouncedAddedTime: false,
      }),
    );
    return parsed;
  }

  if (PERIOD_SPORTS.has(sport)) {
    parsed.text = {
      currentScore: scoreRaw ?? undefined,
      time: timer ?? undefined,
    };
    parsed.seconds = timeToSeconds(timer ?? null);
    parsed.details = details.length > 0 ? details : undefined;

    if (parsedMain) {
      parsed.currentScore = [parsedMain.home, parsedMain.away];
    } else if (details.length > 0) {
      const [h, a] = setsWonFromDetails(details);
      parsed.currentScore = [h, a];
    }

    if (matchPhase) {
      if (isSoccerLikeSport(sport)) {
        const resolved = resolveSoccerPeriod(matchPhase);
        if (resolved != null) parsed.period = resolved;
      } else if (isPeriodClockSport(sport)) {
        const resolved = resolvePeriodSportPeriod(sport, matchPhase, details.length);
        if (resolved != null) parsed.period = resolved;
      } else {
        parsed.period = matchPhase;
      }
    } else if (details.length > 0) {
      parsed.period = details.length;
    }

    if (isSoccerLikeSport(sport)) {
      const extraTime = calcSoccerExtraTime(timer, matchPhase);
      if (extraTime !== null) parsed.extraTime = extraTime;
      const gamePhase = resolveSoccerGamePhaseFromMatchPhase(matchPhase);
      if (gamePhase) parsed.gamePhase = gamePhase;
      applySoccerPhaseRefinement(parsed, matchPhase);
      // When Olimpbet doesn't send match_phase but 5 periods exist → penalties already started
      if (!parsed.gamePhase && details.length >= 5) {
        parsed.gamePhase = 'penalties';
        if (!parsed.period || Number(parsed.period) < 5) parsed.period = 5;
      }
    } else if (isPeriodClockSport(sport)) {
      const gamePhase = resolvePeriodSportGamePhase(sport, matchPhase, details.length);
      if (gamePhase) parsed.gamePhase = gamePhase;
    }

    applyOlimpbetFeedExtras(
      parsed,
      extractOlimpbetFeedExtras(inline, structured?.commonStatistics, {
        includeAnnouncedAddedTime: isSoccerLikeSport(sport),
      }),
    );

    return parsed;
  }

  if (!scoreRaw) return null;

  parsed.text = { currentScore: scoreRaw };
  if (parsedMain) parsed.currentScore = [parsedMain.home, parsedMain.away];
  if (details.length > 0) parsed.details = details;
  return parsed;
}

/** Prefer tracked in-game score when feed briefly shows 0:0 mid-rally. */
export function enrichTennisParsedScoreLiveGame(
  parsedScore: WcParsedScore,
  detail: OlimpbetEventDetail,
  matchState: WcMatchState,
): void {
  const resolved = resolveTennisDisplayGameScore(parsedScore.text?.liveScore, detail, matchState);
  if (!resolved) return;
  if (!parsedScore.text) parsedScore.text = {};
  parsedScore.text.liveScore = resolved;
}

function resolveTennisDisplayGameScore(
  feedScore: string | null | undefined,
  detail: OlimpbetEventDetail,
  matchState: WcMatchState,
): string | null {
  if (feedScore && !isTennisGameStartScore(feedScore)) {
    return formatTennisGameScoreDisplay(feedScore) ?? feedScore;
  }

  const tennis = matchState.tennis;
  if (!tennis) {
    return formatTennisGameScoreDisplay(feedScore) ?? feedScore ?? null;
  }

  const setIndex = getTennisCurrentSetIndex(detail);
  const setGames = getTennisSetGames(detail, setIndex);
  const currentGameIndex = setGames.home + setGames.away + 1;
  const game = tennis.games[tennisGameKey(setIndex, currentGameIndex)];

  const pointsPlayed = (game?.pointsWon?.home ?? 0) + (game?.pointsWon?.away ?? 0);
  if (
    game?.lastGameScore
    && !game.completed
    && (game.trackedFromStart || pointsPlayed > 0)
    && !isTennisGameStartScore(game.lastGameScore)
  ) {
    return formatTennisGameScoreDisplay(game.lastGameScore) ?? game.lastGameScore;
  }

  return formatTennisGameScoreDisplay(feedScore) ?? feedScore ?? null;
}

export function buildWcStatsPayload(
  sport: string,
  detail: Pick<OlimpbetEventDetail, 'statistics' | 'score'>,
  structured?: OlimpbetStructuredStatistics | null,
  options?: { structuredFetched?: boolean; matchState?: WcMatchState | null },
): WcEventStatsPayload {
  const inline = detail.statistics ?? [];
  const parsedScore = buildParsedScore(sport, inline, structured);

  if (
    parsedScore
    && options?.matchState
    && (sport === 'tennis' || sport === 'table-tennis')
    && 'competitors' in detail
  ) {
    enrichTennisParsedScoreLiveGame(parsedScore, detail as OlimpbetEventDetail, options.matchState);
  }

  let homeScore: number | null = null;
  let awayScore: number | null = null;

  const fromParsed = parseScorePair(parsedScore?.text?.currentScore ?? inlineStat(inline, 'score'));
  if (fromParsed) {
    homeScore = fromParsed.home;
    awayScore = fromParsed.away;
  } else if (detail.score?.home != null && detail.score?.away != null) {
    homeScore = Number(detail.score.home);
    awayScore = Number(detail.score.away);
  } else if (
    structured?.homeStatistics?.score != null
    && structured?.awayStatistics?.score != null
  ) {
    homeScore = Number(structured.homeStatistics.score);
    awayScore = Number(structured.awayStatistics.score);
  }

  let statList: WcStatListItem[] = [];
  if (isSoccerLikeSport(sport)) {
    statList = buildSoccerStatList(inline, structured);
  } else if (sport === 'tennis' || sport === 'table-tennis') {
    statList = buildTennisStatList(inline, structured);
  } else if (sport === 'basketball' || sport === 'cyber-basketball') {
    const home = structured?.homeStatistics;
    const away = structured?.awayStatistics;
    addStatRow(statList, 'fouls', 'Фолы', home?.fouls, away?.fouls);
  } else if (sport === 'hockey') {
    const home = structured?.homeStatistics;
    const away = structured?.awayStatistics;
    // fouls in hockey = penalty minutes
    addStatRow(statList, 'penalty_minutes', 'Штрафные мин.', home?.fouls, away?.fouls);
    addStatRow(statList, 'shots_on', 'Броски в створ', home?.shotsOnTarget, away?.shotsOnTarget);
    addStatRow(statList, 'players_on_ice', 'На льду', home?.playersOnIce, away?.playersOnIce);
  } else if (sport === 'volleyball') {
    const home = structured?.homeStatistics;
    const away = structured?.awayStatistics;
    addStatRow(statList, 'aces', 'Эйсы', home?.aces, away?.aces);
    addStatRow(statList, 'fouls', 'Ошибки', home?.fouls, away?.fouls);
    // Volleyball serving indicator (reuse tennis logic)
    const server = inlineStat(inline, 'current_server');
    if (server === '1' || server === '2') {
      statList.push({ id: 'server', name: 'Подача', opp1: server === '1' ? '●' : '○', opp2: server === '2' ? '●' : '○' });
    }
  }

  return {
    parsedScore,
    statList,
    homeScore,
    awayScore,
    structuredFetched: options?.structuredFetched === true,
  };
}

/** Keep period breakdown when odds-only ticks send clock/score without details. */
export function mergeWcParsedScore(
  prev?: WcParsedScore | null,
  incoming?: WcParsedScore | null,
): WcParsedScore | null | undefined {
  if (!incoming && !prev) return null;
  if (!incoming) return prev ?? null;
  if (!prev) return incoming;

  const prevText = prev.text ?? {};
  const incText = incoming.text ?? {};

  const merged = {
    ...prev,
    ...incoming,
    text: {
      ...prevText,
      ...incText,
      currentScore: incText.currentScore || prevText.currentScore,
      liveScore: incText.liveScore || prevText.liveScore,
      time: incText.time || prevText.time,
    },
    details: incoming.details?.length ? incoming.details : prev.details,
    seconds: incoming.seconds ?? prev.seconds,
    period: incoming.period ?? prev.period,
    extraTime: incoming.extraTime ?? prev.extraTime,
    announcedAddedTime: incoming.announcedAddedTime ?? prev.announcedAddedTime,
    varState: incoming.varState ?? prev.varState,
    remainingTimeInPeriodSec: incoming.remainingTimeInPeriodSec ?? prev.remainingTimeInPeriodSec,
    currentTimeInPeriodSec: incoming.currentTimeInPeriodSec ?? prev.currentTimeInPeriodSec,
    overtimeNumber: incoming.overtimeNumber ?? prev.overtimeNumber,
    penaltyRisk: incoming.penaltyRisk ?? prev.penaltyRisk,
    gamePhase: incoming.gamePhase ?? prev.gamePhase,
    currentScore: incoming.currentScore ?? prev.currentScore,
    liveScore: incoming.liveScore ?? prev.liveScore,
  };

  const refinedPhase = refineSoccerGamePhase(
    null,
    merged.seconds,
    merged.gamePhase,
  );
  if (refinedPhase) merged.gamePhase = refinedPhase;
  if (merged.gamePhase === 'extra_time_2') merged.period = 4;
  else if (merged.gamePhase === 'extra_time_1') merged.period = 3;
  else if (merged.gamePhase === 'penalties') merged.period = 5;

  // Infer penalty phase from period details when match_phase wasn't in feed
  if (!merged.gamePhase && (merged.details?.length ?? 0) >= 5) {
    merged.gamePhase = 'penalties';
    if (!merged.period || Number(merged.period) < 5) merged.period = 5;
  }

  return merged;
}

const RICH_STAT_IDS = new Set([
  'possession',
  'corners',
  'yellow_cards',
  'red_cards',
  'yellow_red_cards',
  'shots_on',
  'shots_off',
  'shots',
  'offsides',
  'fouls',
  'dangerous_attacks',
  'substitutions',
  'free_kicks',
  'penalty_score',
  'extra_time_score',
  'saves',
  'woodwork',
  'goal_kicks',
  'outs',
  'expected_goals',
  'aerial_duels',
  'interceptions',
  'dribbles',
  'tackles',
  'players_on_ice',
  'penalty_minutes',
  'aces',
  'double_faults',
  'server',
]);

function statListWeight(list?: WcStatListItem[] | null): number {
  if (!list?.length) return 0;
  let weight = list.length;
  for (const row of list) {
    if (RICH_STAT_IDS.has(row.id)) weight += 10;
  }
  return weight;
}

export function pickRicherStatList(
  prev?: WcStatListItem[] | null,
  incoming?: WcStatListItem[] | null,
): WcStatListItem[] | undefined {
  const prevWeight = statListWeight(prev);
  const incWeight = statListWeight(incoming);
  if (incWeight === 0) return prev ?? undefined;
  if (prevWeight === 0) return incoming;
  return incWeight >= prevWeight ? incoming : prev;
}

const SOCCER_LIST_MIN_WEIGHT = 20;

/** True when live list row still needs Olimpbet `/statistics` (placeholder red_cards only). */
export function statListNeedsEnrichment(
  sport: string,
  list?: WcStatListItem[] | null,
): boolean {
  if (!list?.length) return true;
  if (sport === 'soccer' || sport === 'cyber-football') return statListWeight(list) < SOCCER_LIST_MIN_WEIGHT;
  return statListWeight(list) < 5;
}
