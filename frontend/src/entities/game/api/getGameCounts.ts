import { api } from "~/shared/api";

export interface GameCounts {
  total: number;
  [key: string]: number;
}

export const getLiveGameCounts = async (): Promise<GameCounts> => {
  const { data, error } = await api.GET("/api/games/counts/live");
  if (error) throw error;
  return data || { total: 0 };
};

export const getPrematchGameCounts = async (): Promise<GameCounts> => {
  const { data, error } = await api.GET("/api/games/counts/prematch");
  if (error) throw error;
  return data || { total: 0 };
}; 