import type { Metadata } from "next";

import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import { AiUsagePolicyClient } from "./AiUsagePolicyClient";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoAiTitle", {
    descriptionKey: "common.seoAiDesc",
    path: "/legal/ai-usage-policy",
  });
}

export default function AiUsagePolicyPage() {
  return <AiUsagePolicyClient />;
}
