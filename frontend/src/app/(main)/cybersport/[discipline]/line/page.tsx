import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  disciplineToApiSport,
  isCyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportLineHub } from "~/entities/cybersport/ui/CybersportLineHub";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

type PageProps = {
  params: Promise<{ discipline: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeSeoMetadata("common.seoCyberLineTitle");
  }
  const config = CYBER_DISCIPLINES[discipline];
  return makeSeoMetadata("common.seoDisciplineLineTitle", {
    descriptionKey: "common.seoDisciplineLineDesc",
    path: `/cybersport/${discipline}/line`,
    params: { name: config.label },
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
