import { CybersportGamesFeed } from "~/entities/cybersport/ui/CybersportGamesFeed";
import { CybersportMenu } from "~/entities/cybersport/ui/CybersportMenu";
import { DEFAULT_CYBER_SPORT } from "~/entities/cybersport/lib/cyberSportsList";

import styles from "../../CybersportLayout.module.css";

type LineSportPageProps = {
  params: Promise<{ sport?: string }>;
};

export default async function CybersportLineSportPage({ params }: LineSportPageProps) {
  const { sport: rawSport } = await params;
  const sport = rawSport ?? DEFAULT_CYBER_SPORT;

  return (
    <div className={styles.subPage}>
      <h2 className={styles.subTitle}>Линия</h2>
      <CybersportMenu mode="line" sport={sport} />
      <CybersportGamesFeed sport={sport} variant="prematch" />
    </div>
  );
}
