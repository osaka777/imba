import type { OneWinMatchSnapshot } from './onewin-wc.types';

// 1win push uses «Закончен» (not «Окончен» / «Завершён») — keep both stems.
// Do NOT match bare «итог» / «complete» — those appear in mid-map / market labels.
const FINISHED_STATUS_RE =
  /(?:^|[^а-яa-z])(?:заверш[её]?н|окончен|закончен|ended|finished|закрыт|cancelled|отмен|canceled|abandon|walkover|не\s*состоя)/i;

const LIVE_STATUS_RE =
  /карта|раунд|тайм|четверть|live|к\d|идет|игра|pause|перерыв|halftime|map\s*\d|soon|скоро/i;

export type OneWinEsportsResult = {
  awayScore: number;
  cancelled: boolean;
  completed: boolean;
  homeScore: number;
  periodScores: Array<{ away: number; home: number }>;
};

function parseSide(raw: null | string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isOneWinEsportsFinishedStatus(status: null | string | undefined): boolean {
  if (!status?.trim()) return false;
  return FINISHED_STATUS_RE.test(status);
}

export function isOneWinEsportsLiveStatus(status: null | string | undefined): boolean {
  if (!status?.trim()) return false;
  if (isOneWinEsportsFinishedStatus(status)) return false;
  return LIVE_STATUS_RE.test(status) || status === 'Created';
}

/**
 * Best-effort completion + series score from the match-info push snapshot.
 * We do NOT trust odds.status as a WIN/LOSE oracle (both sides often lock together).
 */
export function resolveOneWinEsportsResult(
  snap: Pick<
    OneWinMatchSnapshot,
    'hasOpenOdds' | 'matchScore' | 'periodsScore' | 'status'
  > & { hasOpenOdds?: boolean | null },
  opts?: { bestOf?: number },
): OneWinEsportsResult {
  const homeScore = parseSide(snap.matchScore?.t1) ?? 0;
  const awayScore = parseSide(snap.matchScore?.t2) ?? 0;
  const periodScores = (snap.periodsScore ?? [])
    .map((p) => ({
      away: parseSide(p.t2) ?? 0,
      home: parseSide(p.t1) ?? 0,
    }))
    .filter((p) => Number.isFinite(p.home) && Number.isFinite(p.away));

  const status = snap.status ?? '';
  const cancelled = /отмен|cancel|abandon|не\s*состоя|walkover/i.test(status);
  const finishedByStatus = isOneWinEsportsFinishedStatus(status);

  const bestOf = opts?.bestOf ?? 0;
  const winsNeeded = bestOf > 0 ? Math.ceil(bestOf / 2) : 0;
  const finishedByBo =
    winsNeeded > 0 && (homeScore >= winsNeeded || awayScore >= winsNeeded);
  // Prefer larger BO when known — safer against premature clinch on BO5.
  // Do NOT treat empty status + hasOpenOdds=false as finished: between maps the
  // book often closes odds for a few seconds and the UI flashed «Окончена».

  const completed = cancelled || finishedByStatus || finishedByBo;

  return {
    awayScore,
    cancelled,
    completed,
    homeScore,
    periodScores,
  };
}
