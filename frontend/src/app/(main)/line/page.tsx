import { Metadata } from "next";
import { Suspense } from "react";

import { LineGames } from "~/entities/game";
import { makeMetadata } from "~/shared/lib";
import { LoadingSpinner } from "~/shared/ui";

import styles from "./layout.module.css";

export const metadata: Metadata = makeMetadata("Линия");

export default function Line() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <LineGames className={styles.games} initialData={[]} />
    </Suspense>
  );
}
