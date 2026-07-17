import { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiSportToDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { CybersportLineHub } from "~/entities/cybersport/ui/CybersportLineHub";
import { makeMetadata } from "~/shared/lib";

export const metadata: Metadata = makeMetadata("Киберспорт — Линия", {
  description: "Prematch-линия киберспорта на Imba.bet: CS2, Dota 2, Valorant и другие дисциплины.",
  path: "/cybersport/line",
});

type LinePageProps = {
  searchParams: Promise<{ sport?: string }>;
};

export default async function CybersportLinePage({ searchParams }: LinePageProps) {
  const params = await searchParams;
  if (params.sport?.startsWith("esports.")) {
    const slug = apiSportToDisciplineSlug(params.sport);
    if (slug) redirect(`/cybersport/${slug}/line`);
  }

  const sport = DEFAULT_CYBER_SPORT;

  return <CybersportLineHub initialSport={sport} />;
}
