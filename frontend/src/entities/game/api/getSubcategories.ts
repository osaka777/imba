import { CYBERSPORT_CATALOG } from "~/entities/cybersport/lib/cyberDisciplineCatalog";
import { api } from "~/shared/api";
import type { Subcategory } from "../types";

interface SubcategoryResponse {
  id: number;
  name: string;
  code: string;
  sport: string;
  isPriority: boolean;
  isActive: boolean;
}

const ALL_SPORTS = [
  "soccer",
  "basketball",
  "hockey",
  "tennis",
  "volleyball",
  "table-tennis",
  ...CYBERSPORT_CATALOG.map((entry) => entry.apiSport),
] as const;

function mapSubcategoryResponse(data: SubcategoryResponse[] | undefined): Subcategory[] {
  if (!data || !Array.isArray(data)) return [];

  return data
    .filter((sub) => sub.isActive !== false)
    .map((sub) => ({
      id: Number(sub.id),
      name: sub.name,
      code: sub.code,
      sport: sub.sport,
      isPriority: Boolean(sub.isPriority),
    }));
}

async function fetchSportSubcategories(sport: string): Promise<Subcategory[]> {
  try {
    const { data } = await api.GET("/api/subcategories/{sport}", {
      params: { path: { sport } },
    });
    return mapSubcategoryResponse(data as SubcategoryResponse[] | undefined);
  } catch (error) {
    console.error(`Error fetching subcategories for ${sport}:`, error);
    return [];
  }
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
  const entries = await Promise.all(
    ALL_SPORTS.map(async (sport) => [sport, await fetchSportSubcategories(sport)] as const),
  );

  return Object.fromEntries(entries) as Record<string, Subcategory[]>;
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