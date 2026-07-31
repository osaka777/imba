import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GameDtoWithGroupedMarkets } from '~/main/game/dto/available-games.dto';

import { cyberGameHasWinnerOdds } from './cybersport-markets.util';
import { olimpbetIdFromCyberGameRef } from './cybersport-mask.util';
import { OneWinEsportsService } from '../onewin-wc/onewin-esports.service';
import { ONEWIN_ESPORTS_CATALOG } from '../onewin-wc/onewin-esports-catalog';

@Injectable()
export class CybersportService {
  constructor(
    private readonly config: ConfigService,
    private readonly oneWinEsports: OneWinEsportsService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('CYBERSPORT_ENABLED', 'true') === 'true';
  }

  /** Cybersport is 1win-only (line, live, video, settlement). Olimpbet is not used. */
  private sourceReady(): boolean {
    return this.isEnabled() && this.oneWinEsports.isEnabled();
  }

  async listLive(
    sport?: string,
    limit = 24,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.sourceReady()) return [];
    return this.oneWinEsports.listLive(sport, limit, tournamentId);
  }

  async listLine(
    sport?: string,
    limit = 24,
    offset = 0,
    tournamentId?: number,
  ): Promise<GameDtoWithGroupedMarkets[]> {
    if (!this.sourceReady()) return [];
    return this.oneWinEsports.listLine(sport, limit, offset, tournamentId);
  }

  async listTournaments(sport?: string): Promise<
    Array<{
      id: number;
      name: string;
      slug: string;
      sportId: number;
      apiSport: string;
      liveCount: number;
      lineCount: number;
      priorityLevel: number;
    }>
  > {
    if (!this.sourceReady()) return [];
    return this.oneWinEsports.listTournaments(sport);
  }

  async getGame(eventId: string): Promise<GameDtoWithGroupedMarkets | null> {
    if (!this.sourceReady()) return null;

    const matchId = olimpbetIdFromCyberGameRef(eventId);
    if (!matchId) return null;

    return this.oneWinEsports.getGame(matchId);
  }

  async counts(): Promise<Record<string, number>> {
    if (!this.sourceReady()) return {};
    return this.oneWinEsports.counts();
  }

  disciplines(): Array<{
    apiSport: string;
    iconUrl: null | string;
    label: string;
    olimpbetId: number;
    pathSlug: string;
  }> {
    if (!this.sourceReady()) {
      return ONEWIN_ESPORTS_CATALOG.map((e) => ({
        apiSport: e.apiSport,
        iconUrl: null,
        label: e.label,
        olimpbetId: e.sportId,
        pathSlug: e.pathSlug,
      }));
    }
    return this.oneWinEsports.disciplines().map((e) => ({
      apiSport: e.apiSport,
      iconUrl: e.iconUrl,
      label: e.label,
      olimpbetId: e.sportId,
      pathSlug: e.pathSlug,
    }));
  }

  /**
   * Homepage cyber widgets: prefer high-priority CS2, then other tops, then rest.
   */
  async pickHomepageLiveWithOdds(
    maxScan = 36,
    limit = 3,
  ): Promise<Array<{ game: GameDtoWithGroupedMarkets; isLive: boolean }>> {
    if (!this.sourceReady()) return [];

    const live = await this.oneWinEsports.listLive(undefined, maxScan);
    const withOdds = live.filter(cyberGameHasWinnerOdds);
    const pool = withOdds.length > 0 ? withOdds : live;

    const ranked = [...pool].sort((a, b) => {
      const aSport = String(a.sport || '').toLowerCase();
      const bSport = String(b.sport || '').toLowerCase();
      const aCs =
        aSport === 'esports.cs' || aSport.includes('cs2') || aSport.includes('csgo')
          ? 1
          : 0;
      const bCs =
        bSport === 'esports.cs' || bSport.includes('cs2') || bSport.includes('csgo')
          ? 1
          : 0;
      const aPri = Number(a.priority ?? 0) || 0;
      const bPri = Number(b.priority ?? 0) || 0;
      const aHigh = aPri > 0 ? 1 : 0;
      const bHigh = bPri > 0 ? 1 : 0;
      const aRank = aCs && aHigh ? 3 : aHigh ? 2 : aCs ? 1 : 0;
      const bRank = bCs && bHigh ? 3 : bHigh ? 2 : bCs ? 1 : 0;
      if (bRank !== aRank) return bRank - aRank;
      if (bPri !== aPri) return bPri - aPri;
      return 0;
    });

    return ranked.slice(0, limit).map((game) => ({ game, isLive: true }));
  }
}
