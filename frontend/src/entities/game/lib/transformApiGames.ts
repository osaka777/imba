import { Games, League } from "../types";

export const transformApiGames = (games: Games): League[] => {
  if (!games.length) {
    return [];
  }

  const leaguesMap: Record<string, League> = {};

  for (const game of games) {
    if (!leaguesMap[game.leagueName]) {
      leaguesMap[game.leagueName] = {
        leagueName: game.leagueName,
        games: [],
      };
    }
    leaguesMap[game.leagueName].games.push(game);
  }

  // Сохраняем порядок игр от бэкенда (новые игры сначала)
  // Не пересортировываем, так как бэкенд уже возвращает правильный порядок

  return Object.values(leaguesMap);
};
