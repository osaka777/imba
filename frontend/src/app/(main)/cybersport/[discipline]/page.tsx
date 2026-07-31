import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  isCyberDisciplineSlug,
  type CyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportDisciplineSection } from "~/entities/cybersport/ui/CybersportDisciplineSection";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

type PageProps = {
  params: Promise<{ discipline: string }>;
};

export function generateStaticParams(): { discipline: CyberDisciplineSlug }[] {
  return Object.keys(CYBER_DISCIPLINES).map((discipline) => ({
    discipline: discipline as CyberDisciplineSlug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    return makeSeoMetadata("common.seoCyberTitle", { path: "/cybersport" });
  }

  const config = CYBER_DISCIPLINES[discipline];
  return makeSeoMetadata("common.seoDisciplineBets", {
    descriptionKey: "common.seoDisciplineDesc",
    path: `/cybersport/${discipline}`,
    params: { name: config.label },
  });
}

export default async function CybersportDisciplinePage({ params }: PageProps) {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    notFound();
  }

  return <CybersportDisciplineSection discipline={discipline} />;
}
