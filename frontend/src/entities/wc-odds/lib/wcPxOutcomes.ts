import type { WcMarketGroup, WcMarketOutcome } from "~/entities/wc-odds/api/client";

function compactLabel(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/Х/g, "X").replace(/1Х/g, "1X");
}

function displayLabel(name: string): string {
  const compact = compactLabel(name);
  if (/^К1\b/i.test(compact)) return "П1";
  if (/^К2\b/i.test(compact)) return "П2";
  return compact;
}

function isHomeName(name: string): boolean {
  const c = compactLabel(name);
  return c === "П1" || /^К1\b/i.test(c) || c === "1X";
}

function isAwayName(name: string): boolean {
  const c = compactLabel(name);
  return c === "П2" || /^К2\b/i.test(c) || c === "X2";
}

function isDrawName(name: string): boolean {
  const c = compactLabel(name);
  return c === "X" || /^никто$/i.test(c) || /^не\s*будет$/i.test(c) || c === "12";
}

export type WcPxOutcomeSet = {
  home: WcMarketOutcome;
  draw?: WcMarketOutcome;
  away: WcMarketOutcome;
  labels: [string, string | undefined, string];
};

function findByOutcomeKeys(group: WcMarketGroup): WcPxOutcomeSet | null {
  const home = group.outcomes.find((o) => o.outcomeKey === "HOME");
  const draw = group.outcomes.find((o) => o.outcomeKey === "DRAW");
  const away = group.outcomes.find((o) => o.outcomeKey === "AWAY");
  if (!home || !away) return null;

  return {
    home,
    draw,
    away,
    labels: draw
      ? [displayLabel(home.name), displayLabel(draw.name), displayLabel(away.name)]
      : [displayLabel(home.name), undefined, displayLabel(away.name)],
  };
}

function findDcByOutcomeKeys(group: WcMarketGroup): WcPxOutcomeSet | null {
  const dc1x = group.outcomes.find((o) => o.outcomeKey === "DC_1X");
  const dc12 = group.outcomes.find((o) => o.outcomeKey === "DC_12");
  const dcx2 = group.outcomes.find((o) => o.outcomeKey === "DC_X2");
  if (!dc1x || !dc12 || !dcx2) return null;

  return {
    home: dc1x,
    draw: dc12,
    away: dcx2,
    labels: ["1X", "12", "X2"],
  };
}

function findByOutcomeNames(group: WcMarketGroup): WcPxOutcomeSet | null {
  let home: WcMarketOutcome | undefined;
  let draw: WcMarketOutcome | undefined;
  let away: WcMarketOutcome | undefined;

  for (const outcome of group.outcomes) {
    const name = outcome.name.trim();
    if (!name || name === "—") continue;

    if (isHomeName(name)) home = outcome;
    else if (isDrawName(name)) draw = outcome;
    else if (isAwayName(name)) away = outcome;
  }

  if (!home || !away) return null;

  return {
    home,
    draw,
    away,
    labels: draw
      ? [displayLabel(home.name), displayLabel(draw.name), displayLabel(away.name)]
      : [displayLabel(home.name), undefined, displayLabel(away.name)],
  };
}

function isYesNoStyleGroup(group: WcMarketGroup): boolean {
  if (/^display_(WINNER_|GOALS_TEAM)/i.test(group.marketKey)) return true;
  if (group.outcomes.some((o) => o.outcomeKey === "YES" || o.outcomeKey === "NO")) return true;
  return group.outcomes.some((o) => /:\s*(да|нет)$/i.test(o.name.trim()));
}

/** Resolve П1 / X / П2 (or 1X / 12 / X2) layout for canonical and display markets. */
export function findPxOutcomes(group: WcMarketGroup): WcPxOutcomeSet | null {
  if (isYesNoStyleGroup(group)) return null;
  if (group.outcomes.length < 2 || group.outcomes.length > 3) return null;

  return (
    findByOutcomeKeys(group)
    ?? findDcByOutcomeKeys(group)
    ?? findByOutcomeNames(group)
  );
}

export function isPxStyleGroup(group: WcMarketGroup): boolean {
  return findPxOutcomes(group) != null;
}
