export type MatchResultPeriod = {
  home: number;
  away: number;
};

export type MatchResultStat = {
  id: string;
  name: string;
  home: string;
  away: string;
};

export type MatchResultGoal = {
  index: number;
  side: "home" | "away";
  minute: number | null;
};

export type MatchResultItem = {
  id: string;
  tournamentId: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamIcon: string | null;
  awayTeamIcon: string | null;
  homeCompetitorId: number | null;
  awayCompetitorId: number | null;
  leagueName: string;
  commenceTime: string;
  settledAt: string | null;
  homeScore: number;
  awayScore: number;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  periodScores: MatchResultPeriod[];
  penaltyScore: MatchResultPeriod | null;
  goalTimeline: MatchResultGoal[];
  statList: MatchResultStat[];
  hasBroadcast: boolean;
  priorityLevel: number;
  isPriority: boolean;
  isLive: boolean;
  href: string;
  source: "olimpbet";
};

export type MatchResultsGroup = {
  leagueName: string;
  matches: MatchResultItem[];
};

export type MatchResultsMode = "finished" | "live";

export type ResultsSportSlug =
  | "soccer"
  | "tennis"
  | "basketball"
  | "hockey"
  | "volleyball"
  | "table-tennis"
  | "mma"
  | "cyber-football"
  | "cyber-basketball";

export type MatchResultsResponse = {
  date: string;
  sport: string;
  mode: MatchResultsMode;
  groups: MatchResultsGroup[];
  total: number;
};

export const RESULTS_SPORTS: Array<{ slug: ResultsSportSlug; label: string }> = [
  { slug: "soccer", label: "Футбол" },
  { slug: "tennis", label: "Теннис" },
  { slug: "basketball", label: "Баскетбол" },
  { slug: "hockey", label: "Хоккей" },
  { slug: "volleyball", label: "Волейбол" },
  { slug: "table-tennis", label: "Наст. теннис" },
  { slug: "mma", label: "MMA" },
  { slug: "cyber-football", label: "Киберфутбол" },
  { slug: "cyber-basketball", label: "Кибербаскет" },
];
