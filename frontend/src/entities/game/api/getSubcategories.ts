import { api } from "~/shared/api";
import type { Subcategory } from "../types";
import type { paths } from "~/shared/api";

interface SubcategoryResponse {
  id: number;
  name: string;
  code: string;
  sport: string;
  isPriority: boolean;
  isActive: boolean;
}

export const getSubcategories = async (sport: string) => {
  const { data, error } = await api.GET("/api/subcategories/{sport}", {
    params: { path: { sport } }
  });
  
  if (error) throw error;
  return (data as SubcategoryResponse[] | undefined) || [];
};

export const getGamesBySubcategory = async (type: "live" | "prematch", sport: string, subcategory: string, limit = 20, offset = 0) => {
  const endpoint = type === "live" 
    ? "/api/games/live/{sport}/{subcategory}" 
    : "/api/games/prematch/{sport}/{subcategory}";
  
  const { data, error } = await api.GET(endpoint, {
    params: {
      path: { sport, subcategory },
      query: { limit: String(limit), offset: String(offset), lastCreatedAt: "" },
    },
  });
  
  if (error) throw error;
  return data;
};

export const getAllSubcategories = async () => {
  const sports = [
    "soccer",
    "basketball",
    "hockey",
    "tennis",
    "volleyball",
    "table-tennis",
    "esports.cs",
    "esports.dota2"
  ] as const;
  const result: Record<string, Subcategory[]> = {};

  for (const sport of sports) {
    try {
      const { data } = await api.GET("/api/subcategories/{sport}", {
        params: { path: { sport } }
      });

      if (data && Array.isArray(data)) {
        result[sport] = (data as SubcategoryResponse[])
          .filter(sub => sub.isActive !== false)
          .map((sub) => ({
            id: Number(sub.id),
            name: sub.name,
            code: sub.code,
            sport: sub.sport,
            isPriority: Boolean(sub.isPriority)
          }));
      } else {
        result[sport] = [];
      }
    } catch (error) {
      console.error(`Error fetching subcategories for ${sport}:`, error);
      result[sport] = [];
    }
  }

  return result;
};

// Новый общий эндпоинт для получения подкатегорий и счётчиков
export const getSubcategoriesWithCounts = async (sport: string, type: "live" | "prematch") => {
  const { data, error } = await api.GET("/api/subcategories-with-counts/{sport}", {
    params: { 
      path: { sport },
      query: { type }
    }
  });
  
  if (error) throw error;
  return data || { subcategories: [], counts: {}, total: 0 };
};