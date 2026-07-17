import { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiSportToDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { CybersportLiveHub } from "~/entities/cybersport/ui/CybersportLiveHub";
import { makeMetadata } from "~/shared/lib";

export const metadata: Metadata = makeMetadata("Киберспорт — Live", {
  description: "Все live-трансляции киберспорта на Imba.bet: CS2, Dota 2, Valorant и другие дисциплины.",
  path: "/cybersport/live",
});

type LivePageProps = {
  searchParams: Promise<{ sport?: string }>;
};

export default async function CybersportLivePage({ searchParams }: LivePageProps) {
  const params = await searchParams;
  if (params.sport?.startsWith("esports.")) {
    const slug = apiSportToDisciplineSlug(params.sport);
    if (slug) redirect(`/cybersport/${slug}/live`);
  }

  const sport = DEFAULT_CYBER_SPORT;

  return <CybersportLiveHub initialSport={sport} />;
}
