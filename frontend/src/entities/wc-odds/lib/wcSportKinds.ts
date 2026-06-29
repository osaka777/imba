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

/** Hockey/basketball feeds often expose remaining period time instead of elapsed. */
export function isCountdownClockSport(sport?: string): boolean {
  return sport === "hockey" || isBasketballLikeSport(sport);
}
