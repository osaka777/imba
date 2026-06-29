/**
 * BetAPI line UI — reference implementation for prematch/live tables.
 * Data: GET /api/games/prematch via entities/game.
 * Do not mix Olimpbet logic here; use entities/wc-odds/line for Olimpbet.
 */
export { GamesPrematch } from "../ui/GamesPrematch/GamesPrematch";
export {
  AllGamesPrematch,
  GamesBySportPrematch,
  GamesPrematchBySportAndSubcategory,
} from "../ui/GamesPrematch";
export { TournamentTable } from "../ui/TournamentTable";
export { MatchRow } from "../ui/TournamentTable/MatchRow";
export { transformApiGames } from "../lib/transformApiGames";
