import { Metadata } from "next";

import { Match } from "~/entities/game/ui/Match";
import { api } from "~/shared/api";
import { makeMetadata } from "~/shared/lib";
import { getSubGameData } from "~/entities/game/api/getSubGames";

type paramsProps = {
  params: { eventId: string };
};

export const dynamic = "force-dynamic";

async function loadGameData(eventId: string) {
  try {
    const { data, response } = await api.GET("/api/game/{eventId}", {
      cache: "no-cache",
      params: { path: { eventId } },
    });
    
    if (response.ok && data) {
      return { data, isSubGame: false };
    }
  } catch (error) {
    console.log(`[loadGameData] Failed to load as main game: ${eventId}`, error);
  }

  try {
    const gameId = parseInt(eventId);
    if (isNaN(gameId)) {
      throw new Error(`Invalid gameId: ${eventId}`);
    }
    
    const subGameData = await getSubGameData(gameId);
    return { data: subGameData, isSubGame: true };
  } catch (error) {
    console.log(`[loadGameData] Failed to load as sub game: ${eventId}`, error);
    throw new Error(`Game not found: ${eventId}`);
  }
}

export async function generateMetadata({ params }: paramsProps): Promise<Metadata> {
  const paramsObj = await params;
  try {
    const { data } = await loadGameData(paramsObj.eventId);
    return makeMetadata(data?.eventName);
  } catch (error) {
    console.error('[generateMetadata] Error loading game data:', error);
    return makeMetadata("Игра");
  }
}

export default async function MatchPage({ params }: paramsProps) {
  const paramsObj = await params;
  const eventId = paramsObj.eventId;

  try {
    const { data, isSubGame } = await loadGameData(eventId);
    return <Match matchData={data} isSubGame={isSubGame} />;
  } catch (error) {
    console.error('[MatchPage] Error loading game data:', error);
    return <div>Игра не найдена</div>;
  }
}
