import { Logger } from '@nestjs/common';
import { GameBetApiType, GameStatus } from '@prisma/client';
import { LRUCache } from 'lru-cache';
import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { BetApiChangeDetector } from './betapi-change-detector';
import { ConfigService } from '@nestjs/config';
import { GameService } from '~/main/game/game.service';
import { PrismaService } from '~/prisma/prisma.service';
import { OddsCorpGateway } from '~/integrations/odds-corp/odds-corp.gateway';
import axios, { AxiosInstance } from 'axios';
import { BetApiEvent, BetApiResponse, OddsDataType, BetApiChangeDetectorEvent } from './types/betapi.types';
import { LanguageService } from '~/shared/services/language.service';

export abstract class BetApiBaseService {
  protected readonly logger: Logger;
  protected readonly HTTPClient: AxiosInstance;
  protected readonly eventCache: LRUCache<string, BetApiEvent>;
  protected readonly events: Map<number, BetApiEvent>;
  protected readonly prevEvents: Map<number, BetApiEvent>;
  protected isProcessing = false;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly gameService: GameService,
    protected readonly prismaService: PrismaService,
    protected readonly wsAdapter: BetApiWebSocketAdapter,
    protected readonly changeDetector: BetApiChangeDetector,
    protected readonly oddsCorpGateway: OddsCorpGateway,
    protected readonly languageService: LanguageService,
    protected readonly dataType: GameBetApiType,
    protected readonly cacheTTL: number,
    protected readonly batchSize: number,
    protected readonly updateInterval: number
  ) {
    this.logger = new Logger(this.constructor.name);
    this.events = new Map();
    this.prevEvents = new Map();
    
    const baseURL = configService.get<string>('BETAPI_HOST');
    const apiKey = configService.get<string>('BETAPI_PACKAGE');

    this.HTTPClient = axios.create({
      baseURL,
      headers: { Package: apiKey },
      timeout: 5000,
      validateStatus: (status) => status === 200
    });

    this.eventCache = new LRUCache({
      max: dataType === GameBetApiType.LINE ? 5000 : 1000,
      ttl: cacheTTL,
      updateAgeOnGet: true,
      ttlAutopurge: true
    });
  }

  protected async request<T = BetApiResponse>(path: string, retryCount = 1): Promise<T> {
    const dataLang = this.languageService.getDefaultLanguage();
    const requestURL = `${path}/${this.dataType.toLowerCase()}/${dataLang}`;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const response = await this.HTTPClient.get<T>(requestURL);
        return response.data;
      } catch (error) {
        if (attempt === retryCount) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }

    throw new Error(`Failed to fetch after ${retryCount} attempts`);
  }

  protected async processBatch(batch: BetApiEvent[], oddsDataType: OddsDataType) {
    try {
      // Обработка батча с учетом типа данных
      await this.gameService.bulkUpsert(
        batch.map(item => ({
          eventId: String(item.eventId || item.game_id),
          eventName: item.game_dop_name,
          leagueName: item.league_name || item.tournament_name,
          sport: item.sport || item.sport_name,
          team1: item.team1_name || item.opp_1_name,
          team2: item.team2_name || item.opp_2_name,
          score: item.score_total || item.score_full || `${item.score1}-${item.score2}`,
          status: this.mapGameStatus(item.game_status),
          meta: {
            sgame_id: item.sgame_id,
            stat_id: item.stat_id,
            ext_game_id: item.ext_game_id,
            game_id: item.game_id,
            game_mid: item.game_mid,
            game_num: item.game_num,
            game_dop_name_langs: item.game_dop_name_langs,
            game_start: item.game_start,
            game_period: item.game_period,
            game_time: item.game_time,
            game_hash: item.game_hash,
            game_tv: item.game_tv,
            game_tv_langs: item.game_tv_langs,
            game_timer_type: item.game_timer_type,
            game_timer_dir: item.game_timer_dir,
            game_timer_seconds: item.game_timer_seconds,
            game_timer_seconds_left: item.game_timer_seconds_left,
            game_timer_updating: item.game_timer_updating,
            game_favorite: item.game_favorite,
            game_markets_count: item.game_markets_count,
            game_markets_count_top: item.game_markets_count_top,
            game_markets_count_main: item.game_markets_count_main,
            game_markets_count_add: item.game_markets_count_add,
            game_markets_count_live: item.game_markets_count_live,
            game_markets_count_line: item.game_markets_count_line,
            game_markets_count_live_main: item.game_markets_count_live_main,
            game_markets_count_line_main: item.game_markets_count_line_main,
            game_markets_count_live_top: item.game_markets_count_live_top,
            game_markets_count_line_top: item.game_markets_count_line_top
          },
          type: this.dataType
        }))
      );

      // Отправка WebSocket событий
      const wsPromises = batch.map(item => 
        this.oddsCorpGateway.onMessage(
          oddsDataType,
          JSON.stringify({
            type: 'update_event',
            eventId: item.eventId,
            data: item
          })
        )
      );

      await Promise.all(wsPromises);
    } catch (error) {
      this.logger.error(`Error processing batch: ${error.message}`, error);
      throw error;
    }
  }

  protected validateResponse(response: any): boolean {
    if (!response || !response.body) {
      this.logger.warn('Invalid response format');
      return false;
    }

    // Accept both arrays and objects for response body
    if (Array.isArray(response.body)) {
      return true;
    } else if (response.body && typeof response.body === 'object') {
      // Valid object response (could be empty, single tournament, or error)
      return true;
    } else {
      this.logger.warn(`Response body has invalid type: ${typeof response.body}`);
      return false;
    }
  }

  private mapGameStatus(status: number): GameStatus {
    switch (status) {
      case 0:
        return GameStatus.PREMATCH;
      case 1:
        return GameStatus.IN_PROGRESS;
      case 2:
        return GameStatus.FINISHED;
      case 3:
        return GameStatus.CANCELED;
      default:
        return GameStatus.PREMATCH;
    }
  }

  protected mapEventForChangeDetector(event: BetApiEvent): BetApiChangeDetectorEvent {
    const baseEvent = {
      ...event,
      eventId: String(event.eventId || event.game_id),
      sgame_id: String(event.sgame_id || event.game_id),
      stat_id: String(event.stat_id || event.game_id),
      ext_game_id: event.ext_game_id || event.game_id,
      game_id: event.game_id,
      game_mid: event.game_mid,
      game_num: event.game_num,
      game_dop_name: event.game_dop_name,
      game_dop_name_langs: event.game_dop_name_langs,
      game_start: event.game_start,
      sport: event.sport || event.sport_name,
      type: this.dataType,
      status: this.mapGameStatus(event.game_status)
    };

    return baseEvent as BetApiChangeDetectorEvent;
  }

  abstract startUpdateTask(): Promise<void>;
  abstract processEvents(events: BetApiEvent[]): Promise<void>;
  abstract updateEvents(sportId: number): Promise<void>;
}