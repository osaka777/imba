import { Suspense } from "react";

import { CybersportGamesFeed } from "~/entities/cybersport/ui/CybersportGamesFeed";
import { CybersportMenu } from "~/entities/cybersport/ui/CybersportMenu";
import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";
import { LoadingSpinner } from "~/shared/ui";

import styles from "../CybersportLayout.module.css";

type LivePageProps = {
  searchParams: Promise<{ sport?: string }>;
};

export default async function CybersportLivePage({ searchParams }: LivePageProps) {
  const params = await searchParams;
  const sport = params.sport ?? DEFAULT_CYBER_SPORT;

  return (
    <div className={styles.subPage}>
      <h2 className={styles.subTitle}>Live</h2>
      <CybersportMenu mode="live" sport={sport} />
      <Suspense fallback={<LoadingSpinner />}>
        <CybersportGamesFeed sport={sport} variant="live" />
      </Suspense>
    </div>
  );
}
