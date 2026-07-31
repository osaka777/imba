export type OneWinTeamRef = {
  id: number;
  name: string;
  slug: string;
};

/** One row from `POST /matches/get-many` (top-parser gateway mirrors 1win.pro fixtures). */
export type OneWinFixtureRow = {
  awayTeam: OneWinTeamRef;
  categoryId: null | number;
  homeTeam: OneWinTeamRef;
  isEsport: boolean;
  live: boolean;
  matchId: number;
  sportId: number;
  sportTag: null | string;
  startAtMs: number;
  tournamentId: null | number;
};

export type OneWinScoreBoardTeamStats = {
  corners?: null | number | string;
  redCards?: null | number | string;
  yellowCards?: null | number | string;
};

/** Raw `match-info-snapshot` payload pushed over the public push-server-v2 socket. */
export type OneWinMatchSnapshot = {
  broadcastId: null | string;
  broadcastUrl: null | string;
  enabledOddsCount: null | number;
  hasOpenOdds: boolean | null;
  liveTrackerUrl: null | string;
  matchId: number;
  matchScore: { t1: string; t2: string } | null;
  matchTimeMs: null | number;
  periodsScore: Array<{ t1: string; t2: string }> | null;
  scoreBoard: { results: Record<string, OneWinScoreBoardTeamStats> } | null;
  sportId: null | number;
  statisticsTrackerUrl: null | string;
  status: null | string;
  updatedAtMs: number;
};

export type OneWinBroadcastPayload = {
  available: boolean;
  streamType: 'hls' | 'iframe' | null;
  streamUrl: null | string;
};
