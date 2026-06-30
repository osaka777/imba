export function isSoccerLikeSport(sport?: string): boolean {
  return sport === "soccer" || sport === "cyber-football";
}

export function isBasketballLikeSport(sport?: string): boolean {
  return sport === "basketball" || sport === "cyber-basketball";
}

export function isPeriodClockSport(sport?: string): boolean {
  return (
    isSoccerLikeSport(sport)
    || isBasketballLikeSport(sport)
    || sport === "hockey"
  );
}

/** Hockey and classic basketball use countdown when the feed sends remaining period time. */
export function isCountdownClockSport(sport?: string): boolean {
  return sport === "hockey" || sport === "basketball";
}

/** Esports ball sports use elapsed quarter/half clocks like soccer, not NA countdown fields. */
export function isEsportsPeriodClockSport(sport?: string): boolean {
  return sport === "cyber-football" || sport === "cyber-basketball";
}
