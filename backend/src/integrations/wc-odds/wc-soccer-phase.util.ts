export type SoccerGamePhase = 'extra_time_1' | 'extra_time_2' | 'penalties' | 'break' | null;

const ET1_START_SEC = 90 * 60;
const ET2_START_SEC = 105 * 60;
const MATCH_END_SEC = 120 * 60;
/** After this elapsed, "break" / awaiting-pens feed codes mean 2nd ET if clock still runs. */
const ET2_PLAYING_GRACE_SEC = 60;
const HALFTIME_END_SEC = 46 * 60;
const FULLTIME_START_SEC = 88 * 60;

const ACTIVE_PLAY_PHASES = new Set(['3', '4', '6', '7', '41', '42']);

export function resolveSoccerGamePhaseFromMatchPhase(matchPhase: string | null): SoccerGamePhase {
  if (!matchPhase) return null;
  if (matchPhase === '31' || matchPhase === '33') return 'break';
  if (matchPhase === '32' || matchPhase === '34') return 'break';
  if (matchPhase === '41') return 'extra_time_1';
  if (matchPhase === '42') return 'extra_time_2';
  if (matchPhase === '50') return 'penalties';
  if (matchPhase === '5') return 'extra_time_1';
  if (matchPhase === '8' || matchPhase === '9') return 'break';
  return null;
}

function clearStaleRegularBreak(
  matchPhase: string | null,
  seconds: number | null | undefined,
  detailsLength: number,
): boolean {
  if (!matchPhase) return false;

  if (ACTIVE_PLAY_PHASES.has(matchPhase)) return true;

  if (matchPhase === '31') {
    if (detailsLength >= 2) return true;
    if (seconds != null && seconds > HALFTIME_END_SEC && seconds < ET1_START_SEC) return true;
  }

  if (matchPhase === '32' && seconds != null && seconds < FULLTIME_START_SEC) {
    return true;
  }

  return false;
}

/** Correct stale break / awaiting-pens codes when the match clock shows active play. */
export function refineSoccerGamePhase(
  matchPhase: string | null | undefined,
  seconds: number | null | undefined,
  declared?: SoccerGamePhase | null,
  detailsLength = 0,
): SoccerGamePhase | null {
  const mp = matchPhase?.trim() || null;

  if (clearStaleRegularBreak(mp, seconds, detailsLength)) {
    return null;
  }

  const base = resolveSoccerGamePhaseFromMatchPhase(mp) ?? declared ?? null;

  if (mp === '50' || base === 'penalties') return 'penalties';
  if (seconds == null || !Number.isFinite(seconds) || seconds < ET1_START_SEC) {
    return base;
  }

  if (seconds >= MATCH_END_SEC) {
    if (mp === '50') return 'penalties';
    if (mp === '34' || base === 'break') return 'break';
    return base;
  }

  if (seconds > ET2_START_SEC + ET2_PLAYING_GRACE_SEC) {
    if (base === 'break' || mp === '34' || mp === '33') return 'extra_time_2';
    if (mp === '42' || base === 'extra_time_2') return 'extra_time_2';
    return 'extra_time_2';
  }

  if (seconds >= ET1_START_SEC) {
    if (base === 'break' && mp === '33' && seconds <= ET2_START_SEC + 120) {
      return 'break';
    }
    if (mp === '41' || base === 'extra_time_1') return 'extra_time_1';
    if (seconds > ET2_START_SEC) {
      return base === 'break' ? 'break' : 'extra_time_2';
    }
    return base ?? 'extra_time_1';
  }

  return base;
}

export function refineSoccerDisplayPeriod(
  matchPhase: string | null | undefined,
  seconds: number | null | undefined,
  period: string | number | null | undefined,
  gamePhase: SoccerGamePhase | null,
): string | number | null | undefined {
  if (gamePhase === 'penalties') return 5;
  if (gamePhase === 'extra_time_2') return 4;
  if (gamePhase === 'extra_time_1') return 3;
  if (gamePhase === 'break' && matchPhase === '34') return 5;
  void seconds;
  return period ?? null;
}

export function applySoccerPhaseRefinement(
  parsed: {
    seconds?: number | null;
    period?: string | number | null;
    gamePhase?: SoccerGamePhase;
    matchPhaseRaw?: string | null;
  },
  matchPhase: string | null,
  detailsLength = 0,
): void {
  parsed.matchPhaseRaw = matchPhase;
  parsed.gamePhase = refineSoccerGamePhase(
    matchPhase,
    parsed.seconds,
    parsed.gamePhase,
    detailsLength,
  );
  const nextPeriod = refineSoccerDisplayPeriod(
    matchPhase,
    parsed.seconds,
    parsed.period,
    parsed.gamePhase ?? null,
  );
  if (nextPeriod != null) parsed.period = nextPeriod;
}
