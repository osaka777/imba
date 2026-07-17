export function isEsportsMapScoreSport(sport?: string | null): boolean {
  return (
    sport === "esports.cs"
    || sport === "esports.csgo"
    || sport === "esports.valorant"
    || sport === "esports.dota2"
  );
}
