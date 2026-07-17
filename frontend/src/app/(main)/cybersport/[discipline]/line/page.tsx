import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  disciplineToApiSport,
  isCyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportLineHub } from "~/entities/cybersport/ui/CybersportLineHub";
import { makeMetadata } from "~/shared/lib";

type PageProps = {
  params: Promise<{ discipline: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeMetadata("Киберспорт — Линия");
  }
  const config = CYBER_DISCIPLINES[discipline];
  return makeMetadata(`${config.label} — Линия`, {
    description: `Prematch-линия и ставки на ${config.label} на Imba.bet.`,
    path: `/cybersport/${discipline}/line`,
  });
}

export default async function CybersportDisciplineLinePage({ params }: PageProps) {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    notFound();
  }

  return (
    <CybersportLineHub
      disciplineSlug={discipline}
      initialSport={disciplineToApiSport(discipline)}
    />
  );
}
