import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

export type HandicapPairRow = {
  key: string;
  group: WcMarketGroup;
  home?: WcMarketOutcome;
  away?: WcMarketOutcome;
  point: string;
};

export function lineFromHandicapOutcome(outcome: WcMarketOutcome): number | null {
  const fromKey = outcome.outcomeKey.match(/^(?:HOME|AWAY)_HCP_(.+)$/);
  if (fromKey) {
    const value = Number(fromKey[1]);
    return Number.isFinite(value) ? value : null;
  }
  const fromName = outcome.name.match(/Ф[12]\s*\((-?[\d.]+)\)/i);
  if (fromName) {
    const value = Number(fromName[1]);
    return Number.isFinite(value) ? value : null;
  }
  if (outcome.point != null && Number.isFinite(Number(outcome.point))) {
    return Number(outcome.point);
  }
  return null;
}

function isHomeHandicapOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith("HOME_HCP_")) return true;
  return /^Ф1\b/i.test(outcome.name.trim());
}

function isAwayHandicapOutcome(outcome: WcMarketOutcome): boolean {
  if (outcome.outcomeKey.startsWith("AWAY_HCP_")) return true;
  return /^Ф2\b/i.test(outcome.name.trim());
}

function formatHandicapLine(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function formatSignedHandicapLine(line: number): string {
  const abs = formatHandicapLine(Math.abs(line));
  if (line > 0) return `+${abs}`;
  if (line < 0) return `−${abs}`;
  return "0";
}

function compactTeamLabel(teamName: string | null | undefined, fallback: string): string {
  const team = teamName?.trim();
  if (!team) return fallback;
  if (team.length <= 14) return team;
  return `${team.slice(0, 12).trim()}…`;
}

/** Pivot-area label: team (or Ф1/Ф2) + signed handicap line. */
export function handicapOutcomeSideLabel(
  outcome: WcMarketOutcome,
  teamName?: string | null,
): string {
  return handicapRowSideLabel(outcome, teamName);
}

/** Row label for classic or cyber (kick) handicap buttons / pivot captions. */
export function handicapRowSideLabel(
  outcome: WcMarketOutcome,
  teamName?: string | null,
  options?: {
    kickChip?: boolean;
    pivot?: number | string;
    side?: "home" | "away";
  },
): string {
  const side = handicapSideLabel(outcome);
  const head = compactTeamLabel(teamName, side);

  if (options?.kickChip) return head;

  const pivotNum = Number(options?.pivot);
  if (options?.side && Number.isFinite(pivotNum)) {
    const line = options.side === "home" ? pivotNum : pivotNum === 0 ? 0 : -pivotNum;
    return `${head} (${formatSignedHandicapLine(line)})`;
  }

  const line = lineFromHandicapOutcome(outcome);
  if (line == null) return head;
  return `${head} (${formatSignedHandicapLine(line)})`;
}

/** @deprecated use handicapOutcomeSideLabel with outcome + team */
export function handicapPairSideLabel(
  side: "home" | "away",
  pivot: number | string,
  teams?: { home?: string; away?: string },
): string {
  const value = Number(pivot);
  const head = side === "home"
    ? compactTeamLabel(teams?.home, "Ф1")
    : compactTeamLabel(teams?.away, "Ф2");

  if (!Number.isFinite(value)) return head;
  if (side === "home") return `${head} (${formatSignedHandicapLine(value)})`;

  const awayLine = value === 0 ? 0 : -value;
  return `${head} (${formatSignedHandicapLine(awayLine)})`;
}

export function handicapDirectionLabel(outcome: WcMarketOutcome): string {
  const line = lineFromHandicapOutcome(outcome);
  const side = handicapSideLabel(outcome);
  if (line == null) return side;
  return `${side} (${formatSignedHandicapLine(line)})`;
}

export function handicapSideLabel(outcome: WcMarketOutcome): string {
  if (outcome.outcomeKey.startsWith("HOME_HCP_") || /^Ф1\b/i.test(outcome.name.trim())) {
    return "Ф1";
  }
  if (outcome.outcomeKey.startsWith("AWAY_HCP_") || /^Ф2\b/i.test(outcome.name.trim())) {
    return "Ф2";
  }
  const match = outcome.name.match(/^(Ф[12])/i);
  if (match) {
    const side = match[1]!.toUpperCase().replace("Ф", "Ф");
    return side.startsWith("Ф") ? side : `Ф${side.slice(-1)}`;
  }
  return "Ф1";
}

export function handicapDrawLabel(): string {
  return "X";
}

export function handicapPivotLabel(
  home?: WcMarketOutcome,
  away?: WcMarketOutcome,
): string {
  const homeLine = home ? lineFromHandicapOutcome(home) : null;
  const awayLine = away ? lineFromHandicapOutcome(away) : null;

  if (homeLine != null && awayLine != null && Math.abs(homeLine + awayLine) < 0.001) {
    return formatHandicapLine(homeLine);
  }
  if (homeLine != null) return formatHandicapLine(homeLine);
  if (awayLine != null) return formatHandicapLine(awayLine);
  return "";
}

/** Pair home/away handicaps within a single market group (same half/scope). */
function buildHandicapPairRowsForGroup(group: WcMarketGroup): HandicapPairRow[] {
  const homes: Array<{ outcome: WcMarketOutcome; line: number }> = [];
  const aways: Array<{ outcome: WcMarketOutcome; line: number }> = [];
  const usedAway = new Set<number>();

  for (const outcome of group.outcomes) {
    const line = lineFromHandicapOutcome(outcome);
    if (line == null) continue;
    if (outcome.outcomeKey.startsWith("HOME_HCP_") || isHomeHandicapOutcome(outcome)) {
      homes.push({ outcome, line });
    } else if (outcome.outcomeKey.startsWith("AWAY_HCP_") || isAwayHandicapOutcome(outcome)) {
      aways.push({ outcome, line });
    }
  }

  homes.sort((a, b) => a.line - b.line);
  aways.sort((a, b) => a.line - b.line);

  const rows: HandicapPairRow[] = [];

  for (const home of homes) {
    let awayIdx = aways.findIndex(
      (away, idx) => !usedAway.has(idx) && Math.abs(away.line + home.line) < 0.001,
    );
    if (awayIdx < 0) {
      awayIdx = aways.findIndex(
        (away, idx) => !usedAway.has(idx) && Math.abs(away.line - home.line) < 0.001,
      );
    }

    if (awayIdx >= 0) {
      usedAway.add(awayIdx);
      const away = aways[awayIdx];
      rows.push({
        key: `${group.key}__${home.line}`,
        group,
        home: home.outcome,
        away: away.outcome,
        point: handicapPivotLabel(home.outcome, away.outcome),
      });
      continue;
    }

    rows.push({
      key: `${group.key}__home__${home.line}`,
      group,
      home: home.outcome,
      point: handicapPivotLabel(home.outcome, undefined),
    });
  }

  for (let idx = 0; idx < aways.length; idx += 1) {
    if (usedAway.has(idx)) continue;
    const away = aways[idx];
    rows.push({
      key: `${group.key}__away__${away.line}`,
      group,
      away: away.outcome,
      point: handicapPivotLabel(undefined, away.outcome),
    });
  }

  return rows;
}

export function buildHandicapPairRows(groups: WcMarketGroup[]): HandicapPairRow[] {
  const rows = groups.flatMap((group) => buildHandicapPairRowsForGroup(group));

  return rows.sort((a, b) => {
    const lineA = lineFromHandicapOutcome(a.home ?? a.away!) ?? 0;
    const lineB = lineFromHandicapOutcome(b.home ?? b.away!) ?? 0;
    return lineA - lineB;
  });
}
