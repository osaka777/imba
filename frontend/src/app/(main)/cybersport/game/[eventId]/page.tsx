import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCybersportGame } from "~/entities/cybersport/api/client";
import {
  cyberGameSupportsWcBetting,
  readCyberWcMeta,
} from "~/entities/cybersport/lib/cyberGameToWcEvent";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { CyberMatchPage } from "~/entities/cybersport/ui/CyberMatchPage";
import { fetchWcEventDetail } from "~/entities/wc-odds/api/client";
import { makeMetadata } from "~/shared/lib";

import styles from "../../CybersportLayout.module.css";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  try {
    const game = await fetchCybersportGame(eventId);
    if (game?.eventName) {
      return makeMetadata(maskCybersportLabel(game.eventName));
    }
  } catch {
    /* ignore */
  }
  return makeMetadata("Матч");
}

export default async function CybersportGamePage({ params }: PageProps) {
  const { eventId } = await params;
  const game = await fetchCybersportGame(eventId);

  if (!game) {
    notFound();
  }

  const wcRef = readCyberWcMeta(game).wcEventRef;
  const initialWcEvent = cyberGameSupportsWcBetting(game) && wcRef
    ? await fetchWcEventDetail(wcRef).catch(() => null)
    : null;

  return (
    <div className={styles.subPage}>
      <CyberMatchPage
        eventId={eventId}
        initialData={game}
        initialWcEvent={initialWcEvent}
      />
    </div>
  );
}
