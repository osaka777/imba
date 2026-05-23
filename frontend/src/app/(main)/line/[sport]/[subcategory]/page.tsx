import { Metadata } from "next";

import { api } from "~/shared/api";
import { GamesPrematchBySportAndSubcategory } from "~/entities/game";
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
    title: `${paramsObj.sport} - ${paramsObj.subcategory} - Prematch режим - Kazik`,
  };
};

export default async function SubcategoryPage({
  params,
}: SubcategoryPageProps) {
  const paramsObj = await params;
  const { sport, subcategory } = paramsObj;
  
  console.log('LINE SubcategoryPage loaded:', { sport, subcategory });

  try {
    const { data, error } = await api.GET("/api/games/prematch/{sport}/{subcategory}", {
      params: {
        path: { sport, subcategory },
        query: { limit: 10 },
      },
    });

    if (error) throw error;

    return (
      <>
        <GamesPrematchBySportAndSubcategory
          initialData={data || []}
          sport={sport}
          subcategory={subcategory}
        />
      </>
    );
  } catch (error) {
    return (
      <>
          <GamesPrematchBySportAndSubcategory
            initialData={[]}
            sport={sport}
            subcategory={subcategory}
          />
      </>
    );
  }
}