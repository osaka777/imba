const SPORT_BACKGROUND_FILES: Record<string, string> = {
  mma: "ufc.png",
  "cyber-football": "soccer.jpg",
  "cyber-basketball": "basketball.jpg",
};

export function getSportBackgroundUrl(sport: string): string {
  const file = SPORT_BACKGROUND_FILES[sport] ?? `${sport}.jpg`;
  return `/${file}`;
}

export function getSportBackgroundCss(sport: string): string {
  return `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%), url(${getSportBackgroundUrl(sport)}) center / cover`;
}
