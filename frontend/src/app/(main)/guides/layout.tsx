import type { Metadata } from "next";
import type { ReactNode } from "react";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoGuidesTitle", {
    descriptionKey: "common.seoGuidesDesc",
    path: "/guides",
  });
}

export default function GuidesLayout({ children }: { children: ReactNode }) {
  return children;
}
