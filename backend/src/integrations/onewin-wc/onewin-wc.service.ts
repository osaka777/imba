import { Injectable, Logger } from '@nestjs/common';

import type { WcStatListItem } from '../wc-odds/wc-odds-statistics.types';
import type {
  OneWinBroadcastPayload,
  OneWinFixtureRow,
  OneWinMatchSnapshot,
} from './onewin-wc.types';
import type { OneWinOddsSnapshot } from './onewin-esports-markets.util';

import { resolveOneWinBroadcastUrl } from './onewin-broadcast-resolve.util';
import { OneWinFixtureIndexService } from './onewin-fixture-index.service';
import { OneWinHttpClient } from './onewin-http.client';
import { OneWinPushFeedService } from './onewin-push-feed.service';

/**
 * Facade over the 1win/top-parser integration: resolves our own events to a
 * 1win matchId (team+kickoff match) and exposes broadcast / live-tracker /
 * corner-card micro-stats sourced from the public push-server socket.
 *
 * Deliberately does NOT touch odds/markets — Olimpbet stays the single
 * primary line source. This is fallback + enrichment only.
 */
@Injectable()
export class OneWinWcService {
  private readonly logger = new Logger(OneWinWcService.name);

  constructor(
    private readonly http: OneWinHttpClient,
    private readonly fixtures: OneWinFixtureIndexService,
    private readonly pushFeed: OneWinPushFeedService,
  ) {}

  /** Broadcast fallback — call only after confirming Olimpbet has nothing for this event. */
  async fetchEventBroadcast(matchId: number): Promise<OneWinBroadcastPayload> {
    if (!this.isEnabled())
      return { available: false, streamType: null, streamUrl: null };

    const snapshot = await this.pushFeed.waitForSnapshot(matchId, 5_000, {
      force: true,
    });
    if (!snapshot?.broadcastUrl) {
      return { available: false, streamType: null, streamUrl: null };
    }

    try {
      return await resolveOneWinBroadcastUrl(this.http, snapshot.broadcastUrl);
    } catch (err) {
      this.logger.debug(
        `resolveOneWinBroadcastUrl failed: ${(err as Error).message}`,
      );
      return { available: false, streamType: null, streamUrl: null };
    }
  }

  getCachedSnapshot(matchId: number): OneWinMatchSnapshot | null {
    return this.pushFeed.getSnapshot(matchId);
  }

  getOddsSnapshot(matchId: number): OneWinOddsSnapshot | null {
    return this.pushFeed.getOddsSnapshot(matchId);
  }

  getEsportsStatisticsTrackerUrl(matchId: number): null | string {
    return this.pushFeed.getSnapshot(matchId)?.statisticsTrackerUrl ?? null;
  }

  /** Animated match tracker widget (bet-broadcast.com) — independent of video availability. */
  getLiveTrackerUrl(matchId: number): null | string {
    return this.pushFeed.getSnapshot(matchId)?.liveTrackerUrl ?? null;
  }

  /** Cold-start: subscribe and wait briefly for the first full push snapshot. */
  waitForSnapshot(
    matchId: number,
    timeoutMs = 2_500,
    options?: { force?: boolean },
  ): Promise<OneWinMatchSnapshot | null> {
    return this.pushFeed.waitForSnapshot(matchId, timeoutMs, options);
  }

  waitForOdds(
    matchId: number,
    timeoutMs = 2_500,
  ): Promise<OneWinOddsSnapshot | null> {
    return this.pushFeed.waitForOdds(matchId, timeoutMs);
  }

  getMatchScore(
    matchId: number,
  ): { awayScore: number; homeScore: number } | null {
    const score = this.pushFeed.getSnapshot(matchId)?.matchScore;
    if (!score) return null;
    const homeScore = Number(score.t1);
    const awayScore = Number(score.t2);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
    return { awayScore, homeScore };
  }

  /**
   * Corner/card micro-stats from the socket `scoreBoard`, mapped into our own
   * WcStatListItem shape so it merges through the existing stat-richness
   * comparison (`pickRicherStatList`) exactly like Olimpbet structured stats.
   * Only used to fill in when Olimpbet has nothing (weight 0 beats an
   * already-good Olimpbet list, per RICH_STAT_IDS weighting).
   */
  getMicroStatList(fixture: OneWinFixtureRow): WcStatListItem[] {
    const snapshot = this.pushFeed.getSnapshot(fixture.matchId);
    const results = snapshot?.scoreBoard?.results;
    if (!results) return [];

    const home = results[String(fixture.homeTeam.id)];
    const away = results[String(fixture.awayTeam.id)];
    if (!home && !away) return [];

    const list: WcStatListItem[] = [];
    const push = (
      id: string,
      name: string,
      h?: null | number | string,
      a?: null | number | string,
    ) => {
      if (h == null && a == null) return;
      list.push({ id, name, opp1: String(h ?? 0), opp2: String(a ?? 0) });
    };

    push('corners', 'Угловые', home?.corners, away?.corners);
    push(
      'yellow_cards',
      'Жёлтые карточки',
      home?.yellowCards,
      away?.yellowCards,
    );
    push('red_cards', 'Красные карточки', home?.redCards, away?.redCards);

    return list;
  }

  /**
   * Cheap, non-blocking check for the `hasBroadcast` badge on events where
   * Olimpbet itself has nothing. Only reads the (TTL-cached) fixture index
   * and whatever push-feed snapshot is already cached — never waits on a
   * fresh socket push or an HTTP embed-resolve, so it's safe to call on
   * every ingest tick without slowing it down.
   *
   * Important: do NOT subscribe here. Live sync hits this for ~170 sports
   * events every few seconds; subscribing flooded the shared 1win push-feed
   * and starved cybersport match-info (odds kept working, streams died).
   */
  async hasLikelyBroadcast(
    commenceTime: Date | string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<boolean> {
    if (!this.isEnabled()) return false;
    const fixture = await this.resolveFixture(commenceTime, homeTeam, awayTeam);
    if (!fixture) return false;
    return this.pushFeed.getSnapshot(fixture.matchId)?.broadcastUrl != null;
  }

  isEnabled(): boolean {
    return this.pushFeed.isEnabled();
  }

  async resolveFixture(
    commenceTime: Date | string,
    homeTeam: string,
    awayTeam: string,
  ): Promise<OneWinFixtureRow | null> {
    if (!this.isEnabled()) return null;
    try {
      return await this.fixtures.findMatchId(commenceTime, homeTeam, awayTeam);
    } catch (err) {
      this.logger.debug(`resolveFixture failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Fire-and-forget pre-subscribe so the socket snapshot is warm before a user opens the match page. */
  warmFixture(fixture: OneWinFixtureRow): void {
    if (!this.isEnabled()) return;
    const snap = this.pushFeed.getSnapshot(fixture.matchId);
    const thin =
      snap &&
      !snap.broadcastUrl &&
      !snap.liveTrackerUrl &&
      !snap.statisticsTrackerUrl;
    if (thin) {
      this.pushFeed.resubscribe([fixture.matchId]);
    } else {
      this.pushFeed.subscribe([fixture.matchId]);
    }
  }

  warmMatchIds(matchIds: number[]): void {
    if (!this.isEnabled()) return;
    const thin = matchIds.filter((id) => {
      const snap = this.pushFeed.getSnapshot(id);
      return (
        snap &&
        !snap.broadcastUrl &&
        !snap.liveTrackerUrl &&
        !snap.statisticsTrackerUrl
      );
    });
    const rest = matchIds.filter((id) => !thin.includes(id));
    if (rest.length) this.pushFeed.subscribe(rest);
    if (thin.length) this.pushFeed.resubscribe(thin);
    this.pushFeed.subscribeOdds(matchIds);
  }

  /**
   * Bounded background warm for sports (no Olimpbet stream). Soft subscribe
   * only + throttled warmSnapshots — keeps cameras/trackers ready without
   * the every-tick resubscribe flood that starved cybersport.
   */
  async warmSportsMediaBatch(
    matchIds: number[],
    timeoutMs = 2_500,
  ): Promise<number> {
    if (!this.isEnabled() || matchIds.length === 0) return 0;
    const unique = [...new Set(matchIds.filter((id) => Number.isFinite(id)))];
    this.pushFeed.subscribe(unique);
    await this.pushFeed.warmSnapshots(unique, timeoutMs);
    return unique.filter((id) => {
      const snap = this.pushFeed.getSnapshot(id);
      return Boolean(
        snap?.broadcastUrl ||
          snap?.liveTrackerUrl ||
          snap?.statisticsTrackerUrl,
      );
    }).length;
  }

  hasCachedBroadcast(matchId: number): boolean {
    return Boolean(this.pushFeed.getSnapshot(matchId)?.broadcastUrl);
  }

  hasCachedTracker(matchId: number): boolean {
    const snap = this.pushFeed.getSnapshot(matchId);
    return Boolean(snap?.liveTrackerUrl || snap?.statisticsTrackerUrl);
  }
}
