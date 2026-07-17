import type { WcEventDetail, WcMarketGroup } from "~/entities/wc-odds/api/client";
import { findYesNoOutcomes } from "~/entities/wc-odds/lib/wcYesNoOutcomes";

export type GoalsTeamPairRow = {
  key: string;
  group: WcMarketGroup;
  teamLabel: string;
  yes?: WcMarketGroup["outcomes"][number];
  no?: WcMarketGroup["outcomes"][number];
};

export function isGoalsTeamMarketGroup(group: WcMarketGroup): boolean {
  return /^display_GOALS_TEAM[12]/i.test(group.marketKey);
}

export function isGoalsTeamCategory(categoryName: string, groups: WcMarketGroup[]): boolean {
  if (/забь[её]т\s+команда\s*[12]/i.test(categoryName)) return true;
  return groups.some(isGoalsTeamMarketGroup);
}

/** Match-level «Забьёт команда N» only — half/interval variants keep their own accordion. */
export function isMatchGoalsTeamCategory(categoryName: string, groups: WcMarketGroup[]): boolean {
  if (!/забь[её]т\s+команда\s*[12]/i.test(categoryName)) return false;
  return groups.some((group) => /^display_GOALS_TEAM[12]$/i.test(group.marketKey));
}

export function resolveGoalsTeamPivotLabel(
  group: WcMarketGroup,
  event: Pick<WcEventDetail, "homeTeam" | "awayTeam">,
): string {
  if (/GOALS_TEAM1/i.test(group.marketKey)) {
    return event.homeTeam?.trim() || "П1";
  }
  if (/GOALS_TEAM2/i.test(group.marketKey)) {
    return event.awayTeam?.trim() || "П2";
  }
  return group.label?.trim() || "";
}

export function buildGoalsTeamPairRows(
  groups: WcMarketGroup[],
  event: Pick<WcEventDetail, "homeTeam" | "awayTeam">,
): GoalsTeamPairRow[] {
  const rows = groups
    .filter(isGoalsTeamMarketGroup)
    .map((group) => {
      const { yes, no } = findYesNoOutcomes(group);
      return {
        key: group.key,
        group,
        teamLabel: resolveGoalsTeamPivotLabel(group, event),
        yes,
        no,
      };
    });

  return rows.sort((left, right) => {
    const leftTeam1 = /GOALS_TEAM1/i.test(left.group.marketKey) ? 0 : 1;
    const rightTeam1 = /GOALS_TEAM1/i.test(right.group.marketKey) ? 0 : 1;
    return leftTeam1 - rightTeam1;
  });
}

/** One accordion «Забьёт» instead of separate team headers. */
export function expandGoalsTeamCategories(
  entries: Array<[string, WcMarketGroup[]]>,
): Array<[string, WcMarketGroup[]]> {
  const goalsTeamGroups: WcMarketGroup[] = [];
  const rest: Array<[string, WcMarketGroup[]]> = [];

  for (const [name, groups] of entries) {
    if (isMatchGoalsTeamCategory(name, groups)) {
      goalsTeamGroups.push(...groups.filter((group) => /^display_GOALS_TEAM[12]$/i.test(group.marketKey)));
      const leftover = groups.filter((group) => !/^display_GOALS_TEAM[12]$/i.test(group.marketKey));
      if (leftover.length) rest.push([name, leftover]);
      continue;
    }
    rest.push([name, groups]);
  }

  if (!goalsTeamGroups.length) return entries;

  const deduped = new Map<string, WcMarketGroup>();
  for (const group of goalsTeamGroups) {
    deduped.set(group.key, group);
  }

  return [...rest, ["Забьёт", [...deduped.values()]]];
}
