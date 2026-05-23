import { Metadata } from "next";

import { api } from "~/shared/api";
import { GamesBySportAndSubcategory } from "~/entities/game";
import { Header } from "~/widgets/Header";

interface SubcategoryPageProps {
  params: {
    sport: string;
    subcategory: string;
  };
}

export const generateMetadata = async ({
  params,
}: SubcategoryPageProps): Promise<Metadata> => {
  const paramsObj = await params;
  return {
    title: `${paramsObj.sport} - ${paramsObj.subcategory} - Live режим - Kazik`,
  };
};

export default async function SubcategoryPage({
  params,
}: SubcategoryPageProps) {
  const paramsObj = await params;
  const { sport, subcategory } = paramsObj;
  
  console.log('LIVE SubcategoryPage loaded:', { sport, subcategory });

  try {
    const { data, error } = await api.GET("/api/games/live/{sport}/{subcategory}", {
      params: {
        path: { sport, subcategory },
        query: { limit: 10 },
      },
    });

    if (error) throw error;

    return (
      <>
        <Header />
        <GamesBySportAndSubcategory
          initialData={data || []}
          sport={sport}
          subcategory={subcategory}
        />
      </>
    );
  } catch (error) {
    return (
      <>
        <Header />
        <GamesBySportAndSubcategory
          initialData={[]}
          sport={sport}
          subcategory={subcategory}
        />
      </>
    );
  }
}