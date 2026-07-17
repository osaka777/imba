import { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CYBER_DISCIPLINES,
  isCyberDisciplineSlug,
  type CyberDisciplineSlug,
} from "~/entities/cybersport/lib/cyberDisciplineSlugs";
import { CybersportDisciplineSection } from "~/entities/cybersport/ui/CybersportDisciplineSection";
import { makeMetadata } from "~/shared/lib";

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
    return makeMetadata("Киберспорт", { path: "/cybersport" });
  }

  const config = CYBER_DISCIPLINES[discipline];
  return makeMetadata(`Ставки на ${config.label}`, {
    description: `${config.label} — live и линия на Imba.bet. Коэффициенты, трансляции и ставки на киберспорт.`,
    path: `/cybersport/${discipline}`,
  });
}

export default async function CybersportDisciplinePage({ params }: PageProps) {
  const { discipline } = await params;
  if (!isCyberDisciplineSlug(discipline)) {
    notFound();
  }

  return <CybersportDisciplineSection discipline={discipline} />;
}
