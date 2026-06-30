/** Persisted per-event state for verified micro-market settlement. */
export type WcTennisGameState = {
  /** True once 40:40 or advantage (50) observed in this game. */
  deuce: boolean;
  /** True after the game finishes (next game starts or set ends). */
  completed: boolean;
  /** Last observed game_score while this game was in progress. */
  lastGameScore?: string;
  /** Point index (1-based) → winner; only reliable when trackedFromStart is true. */
  pointWinners?: Record<string, 'home' | 'away'>;
  /** Points won in this game (for race-to-N markets). */
  pointsWon?: { home: number; away: number };
  /** Feed tracking started at 0:0 for this game — required for point-index settlement. */
  trackedFromStart?: boolean;
};

export type WcMatchStateSoccer = {
  lastHome: number;
  lastAway: number;
  /** 1-based match goal index → scoring side (only goals seen after tracking started). */
  goalScorers?: Record<string, 'home' | 'away'>;
  /** 1-based match goal index → match minute when goal was detected (from feed current_time). */
  goalMinutes?: Record<string, number>;
  /** Half/quarter/ET period scores from scores_by_periods (survives EVENT_CLOSED). */
  periodScores?: Array<{ home: number; away: number }>;
  /** Penalty shootout score when available from feed. */
  penaltyScore?: { home: number; away: number };
  initialized: boolean;
};

export type WcMatchStateTennis = {
  /** Key: `${setIndex}:${gameIndex}` */
  games: Record<string, WcTennisGameState>;
  /** Last observed total games completed in each set (home+away). */
  gamesCompletedBySet: Record<string, number>;
  /** Snapshot of set game scores from feed scores_by_periods (survives EVENT_CLOSED). */
  setScores?: Array<{ home: number; away: number }>;
};

export type WcProbabilitySnapshotResult = 'WIN' | 'LOSE' | 'VOID';

export type WcMatchState = {
  v: 1;
  tennis?: WcMatchStateTennis;
  soccer?: WcMatchStateSoccer;
  /** Key: `${marketId}:${outcomeTypeId}:${sortedParams}` */
  probabilitySnapshots?: Record<string, WcProbabilitySnapshotResult>;
  updatedAt: string;
};

export function tennisGameKey(setIndex: number, gameIndex: number): string {
  return `${setIndex}:${gameIndex}`;
}

export function parseMatchState(raw: unknown): WcMatchState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<WcMatchState>;
  if (obj.v !== 1 || typeof obj.updatedAt !== 'string') return null;
  return obj as WcMatchState;
}

export function emptyMatchState(): WcMatchState {
  return {
    v: 1,
    tennis: { games: {}, gamesCompletedBySet: {} },
    probabilitySnapshots: {},
    updatedAt: new Date().toISOString(),
  };
}
