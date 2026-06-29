const TEAM_TO_ISO: Record<string, string> = {
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  brazil: "br",
  cameroon: "cm",
  canada: "ca",
  "cape verde": "cv",
  "costa rica": "cr",
  croatia: "hr",
  "czech republic": "cz",
  czechia: "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  france: "fr",
  germany: "de",
  ghana: "gh",
  greece: "gr",
  iran: "ir",
  italy: "it",
  japan: "jp",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  norway: "no",
  paraguay: "py",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  spain: "es",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  ukraine: "ua",
  uruguay: "uy",
  usa: "us",
  "united states": "us",
  wales: "gb-wls",
};

export function getWcTeamFlagCode(teamName: string): string | null {
  const key = teamName.trim().toLowerCase();
  if (TEAM_TO_ISO[key]) return TEAM_TO_ISO[key];

  for (const [name, code] of Object.entries(TEAM_TO_ISO)) {
    if (key.includes(name) || name.includes(key)) return code;
  }

  return null;
}

export function getWcTeamFlagUrl(teamName: string): string | null {
  const code = getWcTeamFlagCode(teamName);
  if (!code) return null;
  return `https://flagcdn.com/w80/${code}.png`;
}
