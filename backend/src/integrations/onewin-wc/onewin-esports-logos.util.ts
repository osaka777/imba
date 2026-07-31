/** 1win esports team/player icons live on bstatic CDN (see probe-1win HAR). */
export const ONEWIN_ESPORTS_ICON_BUCKET = 12;

export type OneWinTeamLogoRef = {
  id: number;
  logoUrl?: null | string;
};

type RawLogo = { url?: null | string } | null | undefined;
type RawLogoTeam = {
  id: number;
  logo?: RawLogo;
};

export function parseOneWinLogoUrl(logo: RawLogo): null | string {
  const url = logo?.url?.trim();
  return url || null;
}

/** Prefer team.logo, then the same id in competitors[].logo from get-many/get. */
export function pickOneWinTeamLogoUrl(
  team: RawLogoTeam,
  competitors?: RawLogoTeam[] | null,
): null | string {
  const direct = parseOneWinLogoUrl(team.logo);
  if (direct) return direct;
  const fromCompetitor = competitors?.find((c) => c.id === team.id);
  return parseOneWinLogoUrl(fromCompetitor?.logo);
}

export function buildOneWinEsportsTeamIconUrl(teamId: number): null | string {
  if (!Number.isFinite(teamId) || teamId <= 0) return null;
  return `https://bstatic.live/team-icons/${ONEWIN_ESPORTS_ICON_BUCKET}-${teamId}.webp`;
}

/** API logo when 1win sends it; otherwise CDN guess (img onError → flag in UI). */
export function resolveOneWinEsportsTeamIcon(
  team: OneWinTeamLogoRef,
): null | string {
  const fromApi = team.logoUrl?.trim();
  if (fromApi) return fromApi;
  return buildOneWinEsportsTeamIconUrl(team.id);
}

export function mergeOneWinTeamLogoRef(
  team: OneWinTeamLogoRef,
  logoUrl: null | string | undefined,
): OneWinTeamLogoRef {
  if (!logoUrl?.trim() || team.logoUrl?.trim()) return team;
  return { ...team, logoUrl: logoUrl.trim() };
}
