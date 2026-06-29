import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchCybersportGame } from "~/entities/cybersport/api/client";
import { maskCybersportLabel } from "~/entities/cybersport/lib/maskCybersportLabel";
import { Match } from "~/entities/game/ui/Match";
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

  const matchData = {
    ...game,
    leagueName: maskCybersportLabel(game.leagueName),
    team1: maskCybersportLabel(game.team1),
    team2: maskCybersportLabel(game.team2),
    eventName: maskCybersportLabel(game.eventName),
  };

  return (
    <div className={styles.subPage}>
      <Match matchData={matchData} />
    </div>
  );
}
