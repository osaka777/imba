export type SoccerGamePhase = "extra_time_1" | "extra_time_2" | "penalties" | "break" | null;

const ET1_START_SEC = 90 * 60;
const ET2_START_SEC = 105 * 60;
const MATCH_END_SEC = 120 * 60;
const ET2_PLAYING_GRACE_SEC = 60;
const HALFTIME_END_SEC = 46 * 60;
const FULLTIME_START_SEC = 88 * 60;

const ACTIVE_PLAY_PHASES = new Set(["3", "4", "6", "7", "41", "42"]);

export function resolveSoccerGamePhaseFromMatchPhase(matchPhase: string | null): SoccerGamePhase {
  if (!matchPhase) return null;
  if (matchPhase === "31" || matchPhase === "33") return "break";
  if (matchPhase === "32" || matchPhase === "34") return "break";
  if (matchPhase === "41") return "extra_time_1";
  if (matchPhase === "42") return "extra_time_2";
  if (matchPhase === "50") return "penalties";
  if (matchPhase === "5") return "extra_time_1";
  if (matchPhase === "8" || matchPhase === "9") return "break";
  return null;
}

function clearStaleRegularBreak(
  matchPhase: string | null,
  seconds: number | null | undefined,
  detailsLength: number,
): boolean {
  if (!matchPhase) return false;

  if (ACTIVE_PLAY_PHASES.has(matchPhase)) return true;

  if (matchPhase === "31") {
    if (detailsLength >= 2) return true;
    if (seconds != null && seconds > HALFTIME_END_SEC && seconds < ET1_START_SEC) return true;
  }

  if (matchPhase === "32" && seconds != null && seconds < FULLTIME_START_SEC) {
    return true;
  }

  return false;
}

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

  if (mp === "50" || base === "penalties") return "penalties";
  if (seconds == null || !Number.isFinite(seconds) || seconds < ET1_START_SEC) {
    return base;
  }

  if (seconds >= MATCH_END_SEC) {
    if (mp === "50") return "penalties";
    if (mp === "34" || base === "break") return "break";
    return base;
  }

  if (seconds > ET2_START_SEC + ET2_PLAYING_GRACE_SEC) {
    if (base === "break" || mp === "34" || mp === "33") return "extra_time_2";
    if (mp === "42" || base === "extra_time_2") return "extra_time_2";
    return "extra_time_2";
  }

  if (seconds >= ET1_START_SEC) {
    if (base === "break" && mp === "33" && seconds <= ET2_START_SEC + 120) {
      return "break";
    }
    if (mp === "41" || base === "extra_time_1") return "extra_time_1";
    if (seconds > ET2_START_SEC) {
      return base === "break" ? "break" : "extra_time_2";
    }
    return base ?? "extra_time_1";
  }

  return base;
}

export function refineSoccerDisplayPeriod(
  seconds: number | null | undefined,
  period: string | number | null | undefined,
  gamePhase: SoccerGamePhase | null,
  matchPhase?: string | null,
): string | number | null | undefined {
  if (gamePhase === "penalties") return 5;
  if (gamePhase === "extra_time_2") return 4;
  if (gamePhase === "extra_time_1") return 3;
  if (gamePhase === "break" && matchPhase === "34") return 5;
  void seconds;
  return period ?? null;
}

export function refineWcParsedScorePhase(
  parsed: {
    seconds?: number | null;
    period?: string | number | null;
    gamePhase?: SoccerGamePhase;
    matchPhaseRaw?: string | null;
    details?: [string | number, string | number][];
  } | null | undefined,
  matchPhase?: string | null,
): typeof parsed {
  if (!parsed) return parsed;

  const mp = matchPhase ?? parsed.matchPhaseRaw ?? null;
  const detailsLength = parsed.details?.length ?? 0;

  parsed.gamePhase = refineSoccerGamePhase(mp, parsed.seconds, parsed.gamePhase, detailsLength);
  const nextPeriod = refineSoccerDisplayPeriod(
    parsed.seconds,
    parsed.period,
    parsed.gamePhase ?? null,
    mp,
  );
  if (nextPeriod != null) parsed.period = nextPeriod;
  if (mp) parsed.matchPhaseRaw = mp;
  return parsed;
}

export function isStaleSoccerBreak(parsed?: {
  gamePhase?: SoccerGamePhase;
  seconds?: number | null;
  period?: string | number | null;
  details?: [string | number, string | number][];
  matchPhaseRaw?: string | null;
} | null): boolean {
  if (!parsed || parsed.gamePhase !== "break") return false;
  return clearStaleRegularBreak(
    parsed.matchPhaseRaw ?? null,
    parsed.seconds,
    parsed.details?.length ?? 0,
  ) || Number(parsed.period) >= 2;
}
