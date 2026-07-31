import { Metadata } from "next";
import { Suspense } from "react";

import { CybersportSection } from "~/entities/cybersport/ui/CybersportSection";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";
import { LoadingSpinner } from "~/shared/ui";

import homeStyles from "../(home)/Home.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoCyberTitle", {
    descriptionKey: "common.seoCyberDesc",
    path: "/cybersport",
  });
}

export default function CybersportPage() {
  return (
    <Suspense fallback={<LoadingSpinner className={homeStyles.games} />}>
      <CybersportSection className={homeStyles.games} />
    </Suspense>
  );
}
