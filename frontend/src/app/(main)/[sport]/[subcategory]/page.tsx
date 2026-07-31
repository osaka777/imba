import { Metadata } from "next";

import { api } from "~/shared/api";
import { GamesBySportAndSubcategory } from "~/entities/game";
import { Header } from "~/widgets/Header";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

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
  const label = `${paramsObj.sport} — ${paramsObj.subcategory}`;
  return makeSeoMetadata("common.seoLivePrefix", {
    descriptionKey: "common.seoLiveSportDesc",
    path: `/${paramsObj.sport}/${paramsObj.subcategory}`,
    params: { name: label },
  });
};

export default async function SubcategoryPage({
  params,
}: SubcategoryPageProps) {
  const paramsObj = await params;
  const { sport, subcategory } = paramsObj;

  console.log("LIVE SubcategoryPage loaded:", { sport, subcategory });

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
