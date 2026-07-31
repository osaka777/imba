import { Metadata } from "next";
import { Suspense } from "react";

import { LineGames } from "~/entities/game";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";
import { LoadingSpinner } from "~/shared/ui";

import styles from "./layout.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoLineTitle", {
    descriptionKey: "common.seoLineDesc",
    path: "/line",
  });
}

export default function Line() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <LineGames className={styles.games} initialData={[]} />
    </Suspense>
  );
}
