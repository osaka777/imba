import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  disciplineToApiSport,
  isCyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportLiveHub } from "~/entities/cybersport/ui/CybersportLiveHub";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

type PageProps = {
  params: Promise<{ discipline: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeSeoMetadata("common.seoCyberLiveTitle");
  }
  const config = CYBER_DISCIPLINES[discipline];
  return makeSeoMetadata("common.seoDisciplineLiveTitle", {
    descriptionKey: "common.seoDisciplineLiveDesc",
    path: `/cybersport/${discipline}/live`,
    params: { name: config.label },
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
