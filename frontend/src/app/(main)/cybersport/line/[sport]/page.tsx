import { notFound, redirect } from "next/navigation";

import {
  apiSportFromPathSlug,
  lineSportQueryUrl,
} from "~/entities/cybersport/lib/cyberSportPaths";

type PageProps = {
  params: Promise<{ sport?: string }>;
};

/** Legacy: /cybersport/line/esports.cs → /line?sport=esports.cs */
export default async function CybersportLegacyLineSportPage({ params }: PageProps) {
  const { sport: rawSport } = await params;
  if (!rawSport) {
    redirect(lineSportQueryUrl("esports.cs"));
  }

  const apiSport = rawSport.startsWith("esports.")
    ? rawSport
    : apiSportFromPathSlug(rawSport);

  if (!apiSport) {
    notFound();
  }

  redirect(lineSportQueryUrl(apiSport));
}
