import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCybersportTournaments } from "~/entities/cybersport/api/client";
import {
  disciplineToApiSport,
  isCyberDisciplineSlug,
  type CyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportTournamentSection } from "~/entities/cybersport/ui/CybersportTournamentSection";
import { makeMetadata } from "~/shared/lib";

type PageProps = {
  params: Promise<{ discipline: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline, slug } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeMetadata("Киберспорт", { path: "/cybersport" });
  }

  const apiSport = disciplineToApiSport(discipline);
  const tournaments = await fetchCybersportTournaments(apiSport);
  const tournament = tournaments.find((row) => row.slug === slug);
  if (!tournament) {
    return makeMetadata("Турнир киберспорта", { path: `/cybersport/${discipline}` });
  }

  return makeMetadata(`${tournament.name} — ставки на киберспорт`, {
    description: `Live и линия на ${tournament.name}. Ставки через Imba.bet.`,
    path: `/cybersport/${discipline}/tournament/${slug}`,
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
