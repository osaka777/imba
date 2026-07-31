import { Metadata } from "next";
import { Suspense } from "react";

import { MatchResultsPage } from "~/entities/results";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";
import { LoadingSpinner } from "~/shared/ui";

import styles from "../(home)/Home.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoResultsTitle", {
    descriptionKey: "common.seoResultsDesc",
    path: "/results",
  });
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <MatchResultsPage className={styles.games} />
    </Suspense>
  );
}
