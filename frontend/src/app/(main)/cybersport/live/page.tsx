import { Metadata } from "next";
import { redirect } from "next/navigation";

import { apiSportToDisciplineSlug } from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { CybersportLiveHub } from "~/entities/cybersport/ui/CybersportLiveHub";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoCyberLiveTitle", {
    descriptionKey: "common.seoCyberLiveDesc",
    path: "/cybersport/live",
  });
}

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
