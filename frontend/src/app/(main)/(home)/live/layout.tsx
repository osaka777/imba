import type { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoLiveTitle", {
    descriptionKey: "common.seoLiveDesc",
    path: "/live",
  });
}

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
