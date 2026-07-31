import { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import { AppDownloadClient } from "./AppDownloadClient";
import { getPhoneMatches } from "./liveMatches";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoAppTitle", {
    descriptionKey: "common.seoAppDesc",
    path: "/app",
  });
}

export default async function AppDownloadPage() {
  const matches = await getPhoneMatches();
  return <AppDownloadClient matches={matches} />;
}
