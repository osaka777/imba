import { api } from "~/shared/api";

// Оптимизированные методы для работы с играми
export const getGamesOptimized = async (params?: {
  take?: number;
  skip?: number;
  sport?: string;
  status?: string;
  includeFlagForCountries?: boolean;
}) => {
  const queryParams = new URLSearchParams();
  
  if (params?.take) queryParams.append('take', params.take.toString());
  if (params?.skip) queryParams.append('skip', params.skip.toString());
  if (params?.sport) queryParams.append('sport', params.sport);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.includeFlagForCountries) queryParams.append('includeFlagForCountries', 'true');
  
  const { data, error } = await api.GET(`/game/optimized?${queryParams.toString()}`);
  if (error) throw error;
  return data;
};

// Получение игр, сгруппированных по подкатегориям
export const getGamesBySubcategories = async (params?: {
  take?: number;
  sport?: string;
  status?: string;
  subcategoryType?: string;
}) => {
  const queryParams = new URLSearchParams();
  
  if (params?.take) queryParams.append('take', params.take.toString());
  if (params?.sport) queryParams.append('sport', params.sport);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.subcategoryType) queryParams.append('subcategoryType', params.subcategoryType);
  
  const { data, error } = await api.GET(`/game/bySubcategories?${queryParams.toString()}`);
  if (error) throw error;
  return data;
}; 