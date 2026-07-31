import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, io } from 'socket.io-client';

import type { OneWinMatchSnapshot } from './onewin-wc.types';
import type {
  OneWinOddsGroup,
  OneWinOddsSnapshot,
} from './onewin-esports-markets.util';
import { mergeOneWinOddsGroups } from './onewin-odds-merge.util';

import {
  ONEWIN_WS_HOST,
  ONEWIN_WS_PATH,
  OneWinHttpClient,
} from './onewin-http.client';

const SNAPSHOT_STALE_MS = 20 * 60_000;
const ODDS_STALE_MS = 15 * 60_000;
const PRUNE_INTERVAL_MS = 5 * 60_000;
const HEALTH_INTERVAL_MS = 15_000;
/** No inbound `u` while subscribed ⇒ treat the socket as a half-open zombie. */
const INBOUND_STALE_MS = 60_000;
const RESUBSCRIBE_BATCH = 100;
/**
 * Matches without a stream never satisfy the `hasMedia` check, so an unguarded
 * `waitForSnapshot` re-emitted `subscribe` on every HTTP request for every such
 * match. 1win throttles that burst and stops answering with full snapshots,
 * which starved broadcast URLs for the matches that *do* have a stream.
 */
const RESUBSCRIBE_COOLDOWN_MS = 15_000;

type RawMatchInfoData = {
  broadcast?: { id?: string; url?: string } | null;
  enabledOddsCount?: null | number;
  hasOpenOdds?: boolean | null;
  liveTracker?: { url?: string } | null;
  matchId: number;
  matchScore?: { t1: string; t2: string } | null;
  matchTime?: null | number;
  periodsScore?: Array<{ t1: string; t2: string }> | null;
  scoreBoard?: {
    results: Record<
      string,
      { corners?: string; redCards?: string; yellowCards?: string }
    >;
  } | null;
  sportId?: null | number;
  statisticsTracker?: { url?: string } | null;
  status?: null | string;
};

type RawMatchOddsData = {
  isBaseOddsGroups?: boolean;
  matchId: number;
  oddsGroups?: OneWinOddsGroup[];
};

/**
 * Single long-lived connection to 1win's public push-server (no auth needed).
 * Callers subscribe to matchIds and read cached snapshots synchronously —
 * this is what makes the broadcast/tracker fallback feel instant instead of
 * opening a fresh socket per HTTP request.
 */
@Injectable()
export class OneWinPushFeedService implements OnModuleInit, OnModuleDestroy {
  private enabled = true;
  private healthTimer?: NodeJS.Timeout;
  private lastForceReconnectAtMs = 0;
  private lastInboundAtMs = 0;
  private readonly lastResubscribeAt = new Map<number, number>();
  private readonly logger = new Logger(OneWinPushFeedService.name);
  private readonly oddsSnapshots = new Map<number, OneWinOddsSnapshot>();
  private readonly oddsSubscribedIds = new Set<number>();
  private pruneTimer?: NodeJS.Timeout;
  private reconnecting = false;
  private readonly snapshots = new Map<number, OneWinMatchSnapshot>();
  private socket: Socket | null = null;
  private readonly subscribedIds = new Set<number>();
  private readonly waiters = new Map<
    number,
    Array<(snap: OneWinMatchSnapshot) => void>
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly http: OneWinHttpClient,
  ) {}

  /**
   * The push feed only sends a FULL payload (broadcast/liveTracker/score/etc)
   * right after subscribing — the frequent follow-up "u" messages (driven by
   * odds changes) are partial deltas carrying just `scoreBoard`. Blindly
   * overwriting the cache with those deltas was wiping broadcastUrl/tracker
   * seconds after it first appeared, so we merge: a field only replaces the
   * cached value when the incoming message actually carries that key.
   */
  private applySnapshot(data: RawMatchInfoData | undefined): void {
    if (!data?.matchId) return;

    const prev = this.snapshots.get(data.matchId);

    const snapshot: OneWinMatchSnapshot = {
      broadcastId:
        data.broadcast === undefined
          ? (prev?.broadcastId ?? null)
          : data.broadcast === null
            ? null
            : (data.broadcast.id ?? prev?.broadcastId ?? null),
      // Partial "u" deltas often send `broadcast: { id }` without `url` —
      // never wipe a previously known stream URL in that case.
      broadcastUrl:
        data.broadcast === undefined
          ? (prev?.broadcastUrl ?? null)
          : data.broadcast === null
            ? null
            : (data.broadcast.url ?? prev?.broadcastUrl ?? null),
      enabledOddsCount:
        data.enabledOddsCount !== undefined
          ? (data.enabledOddsCount ?? null)
          : (prev?.enabledOddsCount ?? null),
      hasOpenOdds:
        data.hasOpenOdds !== undefined
          ? (data.hasOpenOdds ?? null)
          : (prev?.hasOpenOdds ?? null),
      liveTrackerUrl:
        data.liveTracker === undefined
          ? (prev?.liveTrackerUrl ?? null)
          : data.liveTracker === null
            ? null
            : (data.liveTracker.url ?? prev?.liveTrackerUrl ?? null),
      matchId: data.matchId,
      matchScore: data.matchScore ?? prev?.matchScore ?? null,
      matchTimeMs: data.matchTime ?? prev?.matchTimeMs ?? null,
      periodsScore: data.periodsScore ?? prev?.periodsScore ?? null,
      scoreBoard: data.scoreBoard ?? prev?.scoreBoard ?? null,
      sportId: data.sportId ?? prev?.sportId ?? null,
      statisticsTrackerUrl:
        data.statisticsTracker === undefined
          ? (prev?.statisticsTrackerUrl ?? null)
          : data.statisticsTracker === null
            ? null
            : (data.statisticsTracker.url ??
              prev?.statisticsTrackerUrl ??
              null),
      status: data.status ?? prev?.status ?? null,
      updatedAtMs: Date.now(),
    };

    this.snapshots.set(data.matchId, snapshot);

    const waiting = this.waiters.get(data.matchId);
    if (!waiting?.length) return;

    // Don't wake waitForSnapshot on scoreboard-only deltas — those lack
    // broadcast/tracker and would otherwise cancel the wait too early.
    const hasMedia =
      Boolean(snapshot.broadcastUrl) ||
      Boolean(snapshot.liveTrackerUrl) ||
      Boolean(snapshot.statisticsTrackerUrl);
    if (!hasMedia) return;

    this.waiters.delete(data.matchId);
    for (const fn of waiting) fn(snapshot);
  }

  private applyOddsSnapshot(
    data: RawMatchOddsData | undefined,
    messageType?: string,
  ): void {
    if (!data?.matchId) return;
    const prev = this.oddsSnapshots.get(data.matchId);
    const incoming = data.oddsGroups;
    // Empty payload — keep previous book.
    if (!incoming || incoming.length === 0) {
      if (!prev) return;
      this.oddsSnapshots.set(data.matchId, {
        ...prev,
        updatedAtMs: Date.now(),
      });
      return;
    }

    const oddsGroups = mergeOneWinOddsGroups({
      incoming,
      messageType,
      previous: prev?.oddsGroups ?? null,
    });
    if (oddsGroups.length === 0) return;

    this.oddsSnapshots.set(data.matchId, {
      isBaseOddsGroups: data.isBaseOddsGroups ?? prev?.isBaseOddsGroups,
      matchId: data.matchId,
      oddsGroups,
      updatedAtMs: Date.now(),
    });
  }

  private connect(): void {
    this.socket = io(ONEWIN_WS_HOST, {
      path: ONEWIN_WS_PATH,
      query: { Language: 'ru-RU', externalPartnerId: this.http.partnerId },
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 15_000,
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.lastInboundAtMs = Date.now();
      this.reconnecting = false;
      this.logger.log('1win push-feed connected');
      this.resubscribeAll();
    });

    this.socket.on('disconnect', (reason) => {
      this.logger.warn(`1win push-feed disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      this.logger.debug(`1win push-feed connect_error: ${err.message}`);
    });

    this.socket.on(
      'u',
      (msg: {
        data?: RawMatchInfoData & RawMatchOddsData;
        messageType?: string;
      }) => {
        this.lastInboundAtMs = Date.now();
        if (
          msg?.messageType === 'match-info-snapshot' ||
          msg?.messageType === 'match-info'
        ) {
          this.applySnapshot(msg.data);
        }
        if (
          msg?.messageType === 'match-odds-snapshot' ||
          msg?.messageType === 'match-odds'
        ) {
          this.applyOddsSnapshot(msg.data, msg.messageType);
        }
      },
    );
  }

  /** Half-open sockets stay `.connected` forever with no `u` — force a bounce. */
  private ensureSocketAlive(): void {
    if (!this.enabled || this.reconnecting) return;
    const watching =
      this.subscribedIds.size > 0 || this.oddsSubscribedIds.size > 0;
    if (!watching) return;
    if (!this.socket?.connected) return;
    if (!this.lastInboundAtMs) return;
    if (Date.now() - this.lastInboundAtMs < INBOUND_STALE_MS) return;
    this.forceReconnect(
      `no inbound for ${Math.round((Date.now() - this.lastInboundAtMs) / 1000)}s`,
    );
  }

  private forceReconnect(reason: string): void {
    if (!this.socket || this.reconnecting) return;
    if (Date.now() - this.lastForceReconnectAtMs < 30_000) return;
    this.reconnecting = true;
    this.lastForceReconnectAtMs = Date.now();
    this.lastResubscribeAt.clear();
    this.logger.warn(`1win push-feed force reconnect: ${reason}`);
    try {
      this.socket.disconnect();
      this.socket.connect();
    } catch (err) {
      this.reconnecting = false;
      this.logger.warn(
        `1win push-feed force reconnect failed: ${(err as Error).message}`,
      );
    }
  }

  private emitSubscribe(matchIds: number[]): void {
    if (matchIds.length === 0 || !this.socket) return;
    this.socket.emit('subscribe', {
      data: { matchIds },
      messageType: 'subscribe-match-info',
    });
  }

  private emitSubscribeOdds(matchIds: number[]): void {
    if (matchIds.length === 0 || !this.socket) return;
    this.socket.emit('subscribe', {
      data: { isBaseOddsGroups: false, matchIds },
      messageType: 'subscribe-match-odds',
    });
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [matchId, snap] of this.snapshots) {
      if (now - snap.updatedAtMs > SNAPSHOT_STALE_MS) {
        this.snapshots.delete(matchId);
        this.subscribedIds.delete(matchId);
        this.lastResubscribeAt.delete(matchId);
      }
    }
    for (const [matchId, snap] of this.oddsSnapshots) {
      if (now - snap.updatedAtMs > ODDS_STALE_MS) {
        this.oddsSnapshots.delete(matchId);
        this.oddsSubscribedIds.delete(matchId);
      }
    }
  }

  private removeWaiter(
    matchId: number,
    fn: (snap: OneWinMatchSnapshot) => void,
  ): void {
    const list = this.waiters.get(matchId);
    if (!list) return;
    const next = list.filter((f) => f !== fn);
    if (next.length > 0) this.waiters.set(matchId, next);
    else this.waiters.delete(matchId);
  }

  private resubscribeAll(): void {
    const ids = [...this.subscribedIds];
    for (let i = 0; i < ids.length; i += RESUBSCRIBE_BATCH) {
      this.emitSubscribe(ids.slice(i, i + RESUBSCRIBE_BATCH));
    }
    const oddsIds = [...this.oddsSubscribedIds];
    for (let i = 0; i < oddsIds.length; i += RESUBSCRIBE_BATCH) {
      this.emitSubscribeOdds(oddsIds.slice(i, i + RESUBSCRIBE_BATCH));
    }
  }

  getOddsSnapshot(matchId: number): OneWinOddsSnapshot | null {
    return this.oddsSnapshots.get(matchId) ?? null;
  }

  getSnapshot(matchId: number): OneWinMatchSnapshot | null {
    return this.snapshots.get(matchId) ?? null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onModuleDestroy(): void {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.socket?.disconnect();
  }

  onModuleInit(): void {
    this.enabled = this.config.get<string>('ONEWIN_ENABLED') !== 'false';
    if (!this.enabled) return;
    this.connect();
    this.pruneTimer = setInterval(() => this.pruneStale(), PRUNE_INTERVAL_MS);
    this.healthTimer = setInterval(
      () => this.ensureSocketAlive(),
      HEALTH_INTERVAL_MS,
    );
  }

  /** Idempotent — only emits for ids we're not already tracking. */
  subscribe(matchIds: number[]): void {
    if (!this.enabled) return;
    const fresh = matchIds.filter(
      (id) => Number.isFinite(id) && !this.subscribedIds.has(id),
    );
    if (fresh.length === 0) return;
    for (const id of fresh) this.subscribedIds.add(id);
    if (this.socket?.connected) this.emitSubscribe(fresh);
  }

  /**
   * Force a (re)subscribe even if we already track this id — needed to get a
   * fresh full match-info-snapshot (broadcast/tracker) after only scoreboard
   * deltas were cached. Throttled via claimResubscribe so hot sync paths
   * cannot spam 1win on every tick.
   */
  resubscribe(matchIds: number[]): void {
    if (!this.enabled) return;
    const ids = matchIds.filter(
      (id) => Number.isFinite(id) && this.claimResubscribe(id),
    );
    if (ids.length === 0) return;
    for (const id of ids) this.subscribedIds.add(id);
    if (this.socket?.connected) this.emitSubscribe(ids);
  }

  /**
   * User-facing path (/play, /tracker): always emit subscribe, cooldown does
   * not apply. Without this, a recent background warm attempt could block
   * media for 15s and the match page looked like “no stream”.
   */
  forceResubscribe(matchIds: number[]): void {
    if (!this.enabled) return;
    const ids = matchIds.filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    const now = Date.now();
    for (const id of ids) {
      this.subscribedIds.add(id);
      this.lastResubscribeAt.set(id, now);
    }
    if (this.socket?.connected) this.emitSubscribe(ids);
  }

  /** Subscribe to full (non-base) odds book for esports line display + betting. */
  subscribeOdds(matchIds: number[]): void {
    if (!this.enabled) return;
    const fresh = matchIds.filter(
      (id) => Number.isFinite(id) && !this.oddsSubscribedIds.has(id),
    );
    if (fresh.length === 0) return;
    for (const id of fresh) this.oddsSubscribedIds.add(id);
    if (this.socket?.connected) this.emitSubscribeOdds(fresh);
  }

  /** Subscribe (if needed) and wait briefly for a fresh snapshot — cold-start path. */
  async waitForSnapshot(
    matchId: number,
    timeoutMs = 3_000,
    options?: { force?: boolean },
  ): Promise<OneWinMatchSnapshot | null> {
    if (!this.enabled) return null;
    // Scoreboard-only "u" deltas refresh updatedAtMs without broadcast/tracker.
    // Returning that thin cache blocks waiting for the full match-info snapshot.
    if (this.hasFreshMedia(matchId)) {
      return this.snapshots.get(matchId) ?? null;
    }

    // Already subscribed + thin cache ⇒ 1win will not re-send full info unless
    // we emit subscribe again. Force resubscribe to pull broadcast/tracker.
    if (options?.force) this.forceResubscribe([matchId]);
    else this.resubscribe([matchId]);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeWaiter(matchId, onSnap);
        // Prefer media; fall back to any snapshot (status/score) so callers can
        // still use the thin payload when 1win truly has no stream.
        resolve(
          this.hasFreshMedia(matchId)
            ? this.snapshots.get(matchId) ?? null
            : options?.force
              ? this.snapshots.get(matchId) ?? null
              : null,
        );
      }, timeoutMs);

      const onSnap = (snap: OneWinMatchSnapshot) => {
        clearTimeout(timer);
        this.removeWaiter(matchId, onSnap);
        resolve(snap);
      };

      const list = this.waiters.get(matchId) ?? [];
      list.push(onSnap);
      this.waiters.set(matchId, list);
    });
  }

  /**
   * Batched cold-start for a whole list page: one `subscribe` emit for every
   * id that still lacks media, then a single shared wait window. Waiting per
   * match instead cost ~1.5s each and, worse, spammed 1win with resubscribes.
   */
  async warmSnapshots(matchIds: number[], timeoutMs = 1_500): Promise<void> {
    if (!this.enabled || matchIds.length === 0) return;

    this.ensureSocketAlive();

    const pending = matchIds.filter(
      (id) => Number.isFinite(id) && !this.hasFreshMedia(id),
    );
    if (pending.length === 0) return;

    // Only ids past cooldown can produce a new full snapshot; waiting on
    // throttled ones would put a flat `timeoutMs` floor under every request.
    const due = pending.filter((id) => this.canResubscribe(id));
    if (due.length === 0) return;

    this.resubscribe(due);
    this.subscribeOdds(due);

    await Promise.all(due.map((id) => this.awaitMedia(id, timeoutMs)));
  }

  /** Waiter registration without emitting — `warmSnapshots` batches the emit. */
  private awaitMedia(matchId: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeWaiter(matchId, onSnap);
        resolve();
      }, timeoutMs);

      const onSnap = () => {
        clearTimeout(timer);
        this.removeWaiter(matchId, onSnap);
        resolve();
      };

      const list = this.waiters.get(matchId) ?? [];
      list.push(onSnap);
      this.waiters.set(matchId, list);
    });
  }

  /**
   * True when a forced resubscribe is allowed now; records the attempt.
   * Always enforces cooldown — Olimpbet live sync used to call resubscribe
   * every few seconds for sports matches without streams, which starved the
   * shared push-feed and blocked full snapshots (broadcast/tracker) for cyber.
   */
  private claimResubscribe(matchId: number): boolean {
    if (!this.canResubscribe(matchId)) return false;
    this.lastResubscribeAt.set(matchId, Date.now());
    return true;
  }

  private canResubscribe(matchId: number): boolean {
    const last = this.lastResubscribeAt.get(matchId) ?? 0;
    return Date.now() - last >= RESUBSCRIBE_COOLDOWN_MS;
  }

  private hasFreshMedia(matchId: number): boolean {
    const cached = this.snapshots.get(matchId);
    if (!cached) return false;
    if (Date.now() - cached.updatedAtMs >= SNAPSHOT_STALE_MS) return false;
    return (
      Boolean(cached.broadcastUrl) ||
      Boolean(cached.liveTrackerUrl) ||
      Boolean(cached.statisticsTrackerUrl)
    );
  }

  async waitForOdds(
    matchId: number,
    timeoutMs = 3_000,
  ): Promise<OneWinOddsSnapshot | null> {
    if (!this.enabled) return null;
    const cached = this.oddsSnapshots.get(matchId);
    if (cached && Date.now() - cached.updatedAtMs < ODDS_STALE_MS)
      return cached;

    this.subscribeOdds([matchId]);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const snap = this.oddsSnapshots.get(matchId);
      if (snap && Date.now() - snap.updatedAtMs < ODDS_STALE_MS) return snap;
      await new Promise((r) => setTimeout(r, 150));
    }
    return this.oddsSnapshots.get(matchId) ?? null;
  }
}
