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

export function formatSignedHandicapLine(value: number): string {
  if (value > 0) return `+${formatHandicapLine(value)}`;
  return formatHandicapLine(value);
}

export function handicapOutcomeLabel(outcome: WcMarketOutcome): string {
  const side = handicapSideLabel(outcome);
  const line = lineFromHandicapOutcome(outcome);
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
