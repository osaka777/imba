import { Metadata } from "next";
import { Suspense } from "react";

import { MatchResultsPage } from "~/entities/results";
import { makeMetadata } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import styles from "../(home)/Home.module.css";

export const metadata: Metadata = makeMetadata("Результаты", {
  description:
    "Результаты и live-счёт матчей на Imba.bet: футбол, теннис, хоккей, баскетбол.",
  path: "/results",
});

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <MatchResultsPage className={styles.games} />
    </Suspense>
  );
}
