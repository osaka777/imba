"use client";

import { useOlimpbetLine } from "~/entities/wc-odds/line/useOlimpbetLine";
import { OlimpbetLineBlocks } from "~/entities/wc-odds/line/OlimpbetLineBlocks";
import { LoadingSpinner } from "~/shared/ui";

import gamesStyles from "~/entities/game/ui/GamesPrematch/GamesPrematch.module.css";

type OlimpbetLineSectionProps = {
  sport?: string;
};

/** Olimpbet events merged into /line — separate from BetAPI (`entities/game`). */
export function OlimpbetLineSection({ sport }: OlimpbetLineSectionProps) {
  const { enabled, initialLoading, leagues } = useOlimpbetLine(sport);

  if (enabled === false) return null;
  if (initialLoading && leagues.length === 0) {
    return <LoadingSpinner className={gamesStyles.loading} />;
  }

  return <OlimpbetLineBlocks leagues={leagues} />;
}
