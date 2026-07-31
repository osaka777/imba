import type { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoInfoTitle", {
    descriptionKey: "common.seoInfoDesc",
    path: "/info",
  });
}

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
