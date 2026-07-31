import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCybersportTournaments } from "~/entities/cybersport/api/client";
import {
  disciplineToApiSport,
  isCyberDisciplineSlug,
  type CyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportTournamentSection } from "~/entities/cybersport/ui/CybersportTournamentSection";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

type PageProps = {
  params: Promise<{ discipline: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline, slug } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeSeoMetadata("common.seoCyberTitle", { path: "/cybersport" });
  }

  const apiSport = disciplineToApiSport(discipline);
  const tournaments = await fetchCybersportTournaments(apiSport);
  const tournament = tournaments.find((row) => row.slug === slug);
  if (!tournament) {
    return makeSeoMetadata("common.seoCyberTournament", { path: `/cybersport/${discipline}` });
  }

  return makeSeoMetadata("common.seoCyberTournamentTitle", {
    descriptionKey: "common.seoCyberTournamentDesc",
    path: `/cybersport/${discipline}/tournament/${slug}`,
    params: { name: tournament.name },
  });
}

export default async function CybersportTournamentPage({ params }: PageProps) {
  const { discipline, slug } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    notFound();
  }

  const apiSport = disciplineToApiSport(discipline);
  const tournaments = await fetchCybersportTournaments(apiSport);
  const tournament = tournaments.find((row) => row.slug === slug);
  if (!tournament) {
    notFound();
  }

  return (
    <CybersportTournamentSection
      discipline={discipline as CyberDisciplineSlug}
      tournament={tournament}
    />
  );
}
