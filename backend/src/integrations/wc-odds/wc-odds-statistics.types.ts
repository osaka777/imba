export type WcStatListItem = {
  id: string;
  name: string;
  opp1: string;
  opp2: string;
};

export type WcParsedScore = {
  text?: {
    time?: string;
    liveScore?: string;
    currentScore?: string;
  };
  seconds?: number;
  period?: string | number;
  /** Stoppage/extra time minutes (e.g. 3 → "+3'"). Computed when clock exceeds 45/90. */
  extraTime?: number | null;
  /** Referee-announced added minutes (Olimpbet add_minutes / additionalMinutes). */
  announcedAddedTime?: number | null;
  /** Active VAR review indicator from feed. */
  varState?: string | null;
  /** Seconds remaining in the current period. */
  remainingTimeInPeriodSec?: number | null;
  /** Seconds elapsed in the current period. */
  currentTimeInPeriodSec?: number | null;
  /** Overtime period index when in extra time. */
  overtimeNumber?: number | null;
  /** Penalty risk / shootout indicator from feed. */
  penaltyRisk?: boolean | null;
  /** Human-readable phase label: 'extra_time_1', 'extra_time_2', 'penalties', 'break' */
  gamePhase?: 'extra_time_1' | 'extra_time_2' | 'penalties' | 'break' | null;
  /** Raw Olimpbet match_phase for soccer refinement. */
  matchPhaseRaw?: string | null;
  details?: [string | number, string | number][];
  currentScore?: [string | number, string | number];
  liveScore?: {
    active?: number;
  };
};

export type WcEventStatsPayload = {
  parsedScore: WcParsedScore | null;
  statList: WcStatListItem[];
  homeScore: number | null;
  awayScore: number | null;
  /** True when `/statistics` structured payload was fetched and applied. */
  structuredFetched?: boolean;
};

export type OlimpbetInlineStat = {
  code: string;
  value: string;
};

export type OlimpbetStructuredStatistics = {
  eventId?: number;
  commonStatistics?: Record<string, unknown> | null;
  homeStatistics?: OlimpbetTeamStatistics | null;
  awayStatistics?: OlimpbetTeamStatistics | null;
};

export type OlimpbetTeamStatistics = {
  score?: number | null;
  periodScore?: number | null;
  gameScore?: number | null;
  corners?: number | null;
  freeKicks?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  yellowRedCards?: number | null;
  penaltyScore?: number | null;
  extraTimeScore?: number | null;
  shotsOnTarget?: number | null;
  shotsOffTarget?: number | null;
  dangerousAttacks?: number | null;
  fouls?: number | null;
  offsides?: number | null;
  substitutions?: number | null;
  playersOnIce?: number | null;
  aces?: number | null;
  doubleFaults?: number | null;
  periodScores?: Array<{ periodNumber: number; score: number }> | null;
  periodStats?: Array<{ periodNumber: number; score: string; type?: string }> | null;
};
