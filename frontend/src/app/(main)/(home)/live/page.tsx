import { Suspense } from "react";

import { LiveGames } from "~/entities/game";
import { LoadingSpinner } from "~/shared/ui";

import styles from "../Home.module.css";

export default function LivePage() {
  return (
    <Suspense fallback={<LoadingSpinner className={styles.games} />}>
      <LiveGames className={styles.games} initialData={[]} />
    </Suspense>
  );
}
