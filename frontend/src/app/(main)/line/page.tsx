import { Metadata } from "next";
import { Suspense } from "react";

import { LineGames } from "~/entities/game";
import { makeMetadata } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import styles from "./layout.module.css";

export const metadata: Metadata = makeMetadata("Линия", {
  description:
    "Прематч-линия Imba.bet: ставки на футбол, теннис, хоккей и другие виды спорта до начала матча.",
  path: "/line",
});

export default function Line() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <LineGames className={styles.games} initialData={[]} />
    </Suspense>
  );
}
