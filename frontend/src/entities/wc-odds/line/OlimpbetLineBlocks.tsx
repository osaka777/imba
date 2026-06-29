"use client";

import { memo } from "react";

import { gamesList } from "~/entities/game";
import type { WcLeagueBlock } from "~/entities/wc-odds/line/groupWcByLeague";
import { WcMatchRow } from "~/entities/wc-odds/ui/WcMatchRow";
import { WcTournamentHead } from "~/entities/wc-odds/ui/WcTournamentHead";

import tableStyles from "~/entities/game/ui/TournamentTable/TournamentTable.module.css";
import wcStyles from "~/entities/wc-odds/ui/WcLine.module.css";

const OlimpbetLeagueBlock = memo(function OlimpbetLeagueBlock({
  block,
  showInlineStats = true,
}: {
  block: WcLeagueBlock;
  showInlineStats?: boolean;
}) {
  if (block.events.length === 0) return null;

  const sportDef = gamesList[block.sport as keyof typeof gamesList] ?? gamesList.soccer;
  const SportIcon = sportDef.Icon;

  return (
    <div className={`${tableStyles.Tournament} ${wcStyles.wcTournament}`}>
      <WcTournamentHead
        Icon={SportIcon}
        name={block.leagueName}
        sport={block.sport}
      />
      <div className={tableStyles.body}>
        {block.events.map((event, index) => (
          <WcMatchRow
            event={event}
            key={event.id}
            rowIndex={index}
            showInlineStats={showInlineStats}
          />
        ))}
      </div>
    </div>
  );
});

type OlimpbetLineBlocksProps = {
  leagues: WcLeagueBlock[];
  showInlineStats?: boolean;
};

export const OlimpbetLineBlocks = memo(function OlimpbetLineBlocks({
  leagues,
  showInlineStats = true,
}: OlimpbetLineBlocksProps) {
  if (leagues.length === 0) return null;

  return (
    <>
      {leagues.map((block) => (
        <OlimpbetLeagueBlock
          block={block}
          key={`${block.sport}::${block.leagueName}`}
          showInlineStats={showInlineStats}
        />
      ))}
    </>
  );
});
