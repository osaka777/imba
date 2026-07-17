import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  disciplineToApiSport,
  isCyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportLiveHub } from "~/entities/cybersport/ui/CybersportLiveHub";
import { makeMetadata } from "~/shared/lib";

type PageProps = {
  params: Promise<{ discipline: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeMetadata("Киберспорт — Live");
  }
  const config = CYBER_DISCIPLINES[discipline];
  return makeMetadata(`${config.label} — Live`, {
    description: `Live-трансляции и ставки на ${config.label} на Imba.bet.`,
    path: `/cybersport/${discipline}/live`,
  });
}

export default async function CybersportDisciplineLivePage({ params }: PageProps) {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    notFound();
  }

  return (
    <CybersportLiveHub
      disciplineSlug={discipline}
      initialSport={disciplineToApiSport(discipline)}
    />
  );
}
