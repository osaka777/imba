import {
  HttpException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameBetApi, GameBetApiType, GameStatus, BetStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { LRUCache } from 'lru-cache';

import {
  BetApiCountriesResponse,
  BetApiCountry,
} from '~/integrations/betapi/types/country';
import {
  BetApiEventResponse,
  BetApiEventsResponse,
} from '~/integrations/betapi/types/event';
import { BetApiResponse } from '~/integrations/betapi/types/response';
import {
  BetApiSport,
  BetApiSportsResponse,
} from '~/integrations/betapi/types/sport';
import {
  BetApiTournament,
  BetApiTournamentResponse,
} from '~/integrations/betapi/types/tournament';
import { OddsCorpGateway } from '~/integrations/odds-corp/odds-corp.gateway';
import { MessageIndexes } from '~/integrations/odds-corp/types/message-indexes';
import { GameService } from '~/main/game/game.service';
import { PrismaService } from '~/prisma/prisma.service';
import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { BetApiChangeDetector } from './betapi-change-detector';
import { EventGateway } from '~/main/event/event.gateway';
import { EventBridgeService } from '~/main/event/event-bridge.service';
import { BetApiTransformService } from '~/integrations/betapi/betapi-transform.service';
import { EventOcList } from '~/integrations/betapi/types/event';
import { Prisma } from '@prisma/client';
import * as util from 'node:util';
import { LanguageService } from '~/shared/services/language.service';

// Оптимизированные константы для лучшего баланса производительности
const HTTP_TIMEOUT = 1500; // Увеличиваем таймаут для стабильности
const HTTP_RETRY_COUNT = 2; // Увеличиваем количество попыток
const HTTP_RETRY_DELAY = 50; // Увеличиваем задержку между попытками
const CIRCUIT_THRESHOLD = 100; // Увеличиваем порог для стабильности
const CIRCUIT_RESET_TIMEOUT = 5000; // Увеличиваем время восстановления
const CIRCUIT_ERROR_DECREMENT = 3; // Медленнее восстанавливаемся после ошибок
const CACHE_TTL = 1200; // Увеличиваем время жизни кэша
const CACHE_STALE_TTL = 2000; // Увеличиваем время жизни устаревшего кэша
const MAX_CONSECUTIVE_ERRORS = 300; // Уменьшаем для более быстрой реакции
const PACKAGE_EXPIRED_POLL_MS = 10 * 60_000; // 10 min when BetAPI package is dead
const EVENT_MIN_INTERVAL = 800; // Уменьшаем минимальный интервал между обновлениями событий

interface ApiStats {
  averageResponseTime: number;
  circuitOpenTime: null | number;
  consecutiveErrors: number;
  errorCount: number;
  isCircuitOpen: boolean;
  lastErrorTime: null | number;
  lastStatus: 'ERROR' | 'OK' | 'TIMEOUT';
  lastSuccessTime: null | number;
  successCount: number;
  timeouts: number;
  totalRequests: number;
}


interface CacheItem<T> {
  data: T;
  expiry: number;
  source: 'API' | 'CACHE';
  timestamp: number;
}

interface EventInFlight {
  [key: string]: Promise<BetApiEventResponse>;
}

interface EventLastFetch {
  [key: string]: number;
}

interface EventsMap {
  [key: string]: Map<number, GameBetApi>;
}

interface TournamentsMap {
  [key: string]: BetApiTournament[];
}

interface SportsMap {
  [key: string]: BetApiSport[];
}

interface CountriesMap {
  [key: string]: BetApiCountry[];
}

@Injectable()
export class BetApiService implements OnModuleInit {
  private readonly EVENT_MIN_INTERVAL = EVENT_MIN_INTERVAL;
  private readonly HTTPClient: AxiosInstance;
  private readonly apiKey: string;
  private gameLastSeenMap: Map<number, number> = new Map();
  // Статистика API для Circuit Breaker
  private apiStats: ApiStats = {
    averageResponseTime: 0,
    circuitOpenTime: null,
    consecutiveErrors: 0,
    errorCount: 0,
    isCircuitOpen: false,
    lastErrorTime: null,
    lastStatus: 'OK',
    lastSuccessTime: null,
    successCount: 0,
    timeouts: 0,
    totalRequests: 0,
  };
  private readonly baseURL: string;

  private countries: CountriesMap = { line: [], live: [] };

  private readonly dataLang: string;

  private readonly dataType: string;

  private readonly supportedSportIds: number[];

  private eventCache: LRUCache<string, CacheItem<BetApiEventResponse>> = new LRUCache({
    max: 500,
    ttl: CACHE_TTL,
    updateAgeOnGet: true,
    ttlAutopurge: true,
    allowStale: true
  });
  private eventInFlight: EventInFlight = {};
  private eventLastFetch: EventLastFetch = {};
  private events: EventsMap = { line: new Map(), live: new Map() };
  private isTaskUpdateEventsRunning = false;
  private prevEvents: EventsMap = { line: new Map(), live: new Map() };
  private iterationCount = 0;
  private memoryWarningCount = 0;
  private packageExpired = false;
  private packageExpiredLogged = false;
  private sports: SportsMap = { line: [], live: [] };
  private tournaments: TournamentsMap = { line: [], live: [] };
  
  // Мониторинг производительности
  private performanceMetrics = {
    saveEvents: { totalTime: 0, calls: 0, slowCalls: 0 },
    processBatch: { totalTime: 0, calls: 0, slowCalls: 0 },
    dbQueries: { totalTime: 0, calls: 0, slowCalls: 0 },
    webSocketSends: { totalTime: 0, calls: 0, slowCalls: 0 }
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly gameService: GameService,
    private readonly prismaService: PrismaService,
    private readonly OddsCorpGateway: OddsCorpGateway,
    private readonly eventGateway: EventGateway,
    private readonly eventBridge: EventBridgeService,
    @Inject('winston') private readonly logger: Logger,
    private readonly wsAdapter: BetApiWebSocketAdapter,
    private readonly changeDetector: BetApiChangeDetector,
    private readonly languageService: LanguageService,
  ) {
    this.baseURL = configService.get<string>('BETAPI_HOST');
    this.apiKey = configService.get<string>('BETAPI_PACKAGE');
    this.dataLang =
      configService.get<string>('BETAPI_DEFAULT_LANGUAGE') || this.languageService.getDefaultLanguage();
    this.dataType =
      configService.get<string>('BETAPI_DEFAULT_DATA_TYPE') || 'live';

    // Логируем конфигурацию для отладки
    this.logger.log('info', `BetAPI Configuration: baseURL=${this.baseURL}, apiKey=${this.apiKey ? 'SET' : 'EMPTY'}`);

    if (!this.apiKey) {
      this.logger.error('BETAPI_PACKAGE is not set in environment variables!');
    }

    this.HTTPClient = axios.create({
      baseURL: this.baseURL,
      headers: {
        'PACKAGE': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: HTTP_TIMEOUT,
      validateStatus: (status) => status === 200,
    });

    this.events = { line: new Map(), live: new Map() };
    this.prevEvents = { line: new Map(), live: new Map() };

    // Initialize supported sport IDs from environment variable
    const sportIdsStr = this.configService.get<string>('BETAPI_SPORTS_IDS', '1,2,3,4,6,10,86,97');
    this.supportedSportIds = sportIdsStr.split(',').map(id => parseInt(id.trim(), 10));

    this.logger.log('info', `Initialized BetAPI service with supported sports IDs: ${this.supportedSportIds.join(', ')}`);

    // Подписываемся на события WebSocket адаптера
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wsAdapter.on('open', () => {
      this.logger.warn('BetAPI WebSocket adapter connected');
    });

    this.wsAdapter.on('message', (data: string) => {
      try {
        const event = JSON.parse(data);
        // Полностью отключаем логирование для каждого события
        // this.logger.debug('WS event received', { eventId: event.eventId, type: event.type });
        this.forwardToOddsCorp(event);
      } catch (error) {
        this.logger.error('WS event error:', error);
      }
    });

    this.wsAdapter.on('error', (error) => {
      this.logger.error('WS adapter error:', error);
    });
  }

  // Retry helper to mitigate Postgres deadlocks (40P01) on concurrent updates
  private async withDeadlockRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
    let attempt = 0;
    let lastError: any;
    while (attempt <= retries) {
      try {
        return await fn();
      } catch (e: any) {
        const code = e?.code || e?.meta?.code || e?.message;
        const isDeadlock = typeof code === 'string' && code.includes('40P01');
        if (!isDeadlock || attempt === retries) {
          this.logger.error(`DB error (${label}) after ${attempt + 1} attempts:`, e?.message || e);
          throw e;
        }
        const backoff = 100 * Math.pow(2, attempt); // 100ms, 200ms, 400ms
        this.logger.warn(`Deadlock detected (${label}), retrying in ${backoff}ms... [${attempt + 1}/${retries}]`);
        await new Promise(res => setTimeout(res, backoff));
        attempt++;
        lastError = e;
      }
    }
    throw lastError;
  }

  private forwardToOddsCorp(event: any): void {
    try {
      const wsData = [];
      wsData[MessageIndexes.TYPE] = event.type;
      wsData[MessageIndexes.BK_EVENT_ID] = event.eventId;
      wsData[MessageIndexes.DATA] = event.data;

      const dataType = event.data.dataType === GameBetApiType.LINE ? 'prematch' : 'live';

      this.OddsCorpGateway.onMessage(
        dataType,
        JSON.stringify(wsData)
      ).catch(error => {
        this.logger.error('Error forwarding to OddsCorp:', error);
      });
    } catch (error) {
      this.logger.error('Error preparing OddsCorp message:', error);
    }
  }

  private checkCircuitBreaker(): boolean {
    if (this.packageExpired) return true;
    if (this.apiStats.isCircuitOpen) {
      const now = Date.now();
      if (
        this.apiStats.circuitOpenTime &&
        now - this.apiStats.circuitOpenTime > CIRCUIT_RESET_TIMEOUT
      ) {
        this.apiStats.isCircuitOpen = false;
        this.apiStats.consecutiveErrors = Math.max(0, CIRCUIT_THRESHOLD - 5);
        return false;
      }
      return true;
    }
    return false;
  }

  private async getCachedData<T extends BetApiResponse<any>>(
    cacheKey: string,
    fetchFunc: () => Promise<T>,
    ttl: number = this.dataType === 'live' ? 5000 : 10000,
  ): Promise<{ data: T; source: 'API' | 'CACHE' }> {
    const now = Date.now();
    const cachedItem = this.eventCache.get(cacheKey);

    // Если circuit breaker открыт и есть кешированные данные
    if (this.apiStats.isCircuitOpen && cachedItem) {
      if (now - cachedItem.timestamp < CACHE_STALE_TTL * 3) {
        this.logger.debug(
          `Circuit breaker open, using cached data for ${cacheKey} (age: ${now - cachedItem.timestamp}ms)`,
        );
        return { data: cachedItem.data as T, source: 'CACHE' };
      } else {
        this.logger.warn(
          `Circuit breaker open, but cache too old for ${cacheKey}, returning empty response`,
        );
        return {
          data: { status: 1, body: {} as GameBetApi, page: '' } as T,
          source: 'CACHE',
        };
      }
    }

    // Если данные в кеше свежие - возвращаем их
    if (cachedItem && now < cachedItem.expiry) {
      return { data: cachedItem.data as T, source: 'CACHE' };
    }

    try {
      const data = await fetchFunc();

      // Обновляем кеш с новыми данными
      this.eventCache.set(cacheKey, {
        data,
        expiry: now + ttl,
        source: 'API',
        timestamp: now,
      });

      return { data, source: 'API' };
    } catch (error) {
      // Добавляем информацию о времени начала для расчета в request методе
      error.startTime = error.startTime || Date.now();

      // В случае ошибки используем устаревшие данные из кеша, если они есть
      if (cachedItem && now - cachedItem.timestamp < CACHE_STALE_TTL) {
        this.logger.warn(
          `API error, using stale cache for ${cacheKey}: ${error.message}`,
        );
        return { data: cachedItem.data as T, source: 'CACHE' };
      }

      return {
        data: { status: 1, body: {} as GameBetApi, page: '' } as T,
        source: 'CACHE',
      };
    }
  }

  private async request<T extends BetApiResponse<any>>(
    path: string,
    dataType: 'line' | 'live' = 'line',
    dataLang: string = this.dataLang,
    retryCount = HTTP_RETRY_COUNT,
    retryDelay = HTTP_RETRY_DELAY,
  ): Promise<T> {
    const requestURL = `${path}/${dataType}/${dataLang}`;
    const cacheKey = `request:${requestURL}`;

    try {
      const fetchData = async (): Promise<T> => {
        if (this.checkCircuitBreaker()) {
          throw new Error(`Circuit breaker is open for ${requestURL}`);
        }
        for (let attempt = 1; attempt <= retryCount; attempt++) {
          const attemptStartTime = Date.now();
          try {
            const response = await this.HTTPClient.get<T>(requestURL);
            const attemptEndTime = Date.now();
            const attemptDuration = attemptEndTime - attemptStartTime;

            const { data } = response;

            if (data.status !== 1) {
              if (data.status === 99) {
                this.markPackageExpired();
                throw new HttpException(data.body, data.status);
              }

              if (attempt < retryCount) {
                // this.logger.warn(
                //   `BetAPI response error (attempt ${attempt}/${retryCount}): ${util.inspect(data)}. Retrying... - Duration: ${attemptDuration}ms`,
                //   BetApiService.name,
                // );
                await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
                continue;
              }

              // this.logger.error(
              //   `BetAPI response error (final attempt ${attempt}/${retryCount}): ${util.inspect(data)} - Duration: ${attemptDuration}ms`,
              //   BetApiService.name,
              // );
              throw new HttpException(data.body, data.status);
            }

            // Ensure page field is present for BetApiEventResponse
            if (path.includes('/event/')) {
              return {
                ...data,
                page: (data as any).page || ''
              } as T;
            }

            return data;
          } catch (error) {
            const attemptEndTime = Date.now();
            const attemptDuration = attemptEndTime - attemptStartTime;

            if (
              error.response &&
              (error.response.status === 503 ||
                error.response.status === 502 ||
                error.response.status === 500)
            ) {
              if (attempt < retryCount) {
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay * Math.pow(1.5, attempt - 1)),
                );
                continue;
              }
            }
            else if (
              error.code === 'ECONNABORTED' ||
              error.response?.status === 504
            ) {
              if (attempt < retryCount) {
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay * attempt),
                );
                continue;
              }
            }

            if (attempt < retryCount) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * attempt),
              );
              continue;
            }

            throw error;
          }
        }

        throw new Error(`Failed to fetch data after ${retryCount} retries`);
      };

      const startTime = Date.now();
      const { data } = await this.getCachedData(cacheKey, fetchData);
      const responseTime = Date.now() - startTime;
      
      // Обновляем статистику при успешном запросе
      this.updateApiStats(true, responseTime);
      
      return data;
    } catch (error) {
      const responseTime = Date.now() - (error.startTime || Date.now());
      
      // Обновляем статистику при ошибке
      this.updateApiStats(
        false,
        responseTime,
        error.code === 'ECONNABORTED' ? 'timeout' : 'error',
      );
      
      if (this.apiStats.errorCount % 10 === 0) {
        this.logger.error(
          `BetAPI request failed for URL: ${requestURL}: ${error.message}`,
          BetApiService.name,
        );
      }
      throw error;
    }
  }

  private updateApiStats(
    success: boolean,
    responseTime: number,
    errorType?: string,
  ): void {
    const now = Date.now();
    this.apiStats.totalRequests++;

    if (success) {
      this.apiStats.successCount++;
      this.apiStats.lastStatus = 'OK';
      this.apiStats.lastSuccessTime = now;

      if (this.apiStats.consecutiveErrors > 0) {
        this.apiStats.consecutiveErrors = Math.max(
          0,
          this.apiStats.consecutiveErrors - CIRCUIT_ERROR_DECREMENT,
        );
        if (
          this.apiStats.consecutiveErrors < CIRCUIT_THRESHOLD &&
          this.apiStats.isCircuitOpen
        ) {
          this.apiStats.isCircuitOpen = false;
          this.apiStats.circuitOpenTime = null;
        }
      }
    } else {
      this.apiStats.errorCount++;
      this.apiStats.lastStatus = errorType === 'timeout' ? 'TIMEOUT' : 'ERROR';
      this.apiStats.lastErrorTime = now;
      this.apiStats.consecutiveErrors = Math.min(
        this.apiStats.consecutiveErrors + 1,
        MAX_CONSECUTIVE_ERRORS,
      );

      if (errorType === 'timeout') {
        this.apiStats.timeouts++;
      }

      if (
        this.apiStats.consecutiveErrors >= CIRCUIT_THRESHOLD &&
        !this.apiStats.isCircuitOpen
      ) {
        this.apiStats.isCircuitOpen = true;
        this.apiStats.circuitOpenTime = now;
        this.logger.warn(
          `Circuit breaker OPEN after ${this.apiStats.consecutiveErrors} consecutive errors!`,
        );
      }
    }

    const weight = 0.2;
    this.apiStats.averageResponseTime =
      weight * responseTime + (1 - weight) * this.apiStats.averageResponseTime;
  }

  async fetchAllEvents(eventIds) {
    const startTime = Date.now();

    const promises = eventIds.map(async (eventId) => {
      try {
        const data = await this.fetchEventData(eventId);
        return { [eventId]: data };
      } catch (error) {
        this.logger.warn(`Failed to fetch event ${eventId}:`, error.message);
        return { [eventId]: null };
      }
    });

    try {
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulResults = {};
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const key = Object.keys(result.value)[0];
          if (result.value[key] !== null) {
            successfulResults[key] = result.value[key];
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
          const errorMessage = result.status === 'rejected' ? result.reason?.message || 'Unknown error' : 'Unknown error';
          this.logger.warn(`Event ${eventIds[index]} failed:`, errorMessage);
        }
      });

      this.logger.info(`fetchAllEvents completed - Duration: ${duration}ms, Success: ${successCount}, Failed: ${failureCount}`);

      return successfulResults;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.logger.error(
        `Critical error in fetchAllEvents - Duration: ${duration}ms`,
        error,
      );
      throw error;
    }
  }

  async fetchSubGameData(eventId: string | number): Promise<BetApiEventResponse> {
    const cacheKey = `sub_game_data:${eventId}`;

    try {
      const fetchData = async (): Promise<BetApiEventResponse> => {
        try {
          // Определяем правильный dataType на основе статуса игры в базе данных
          let dataType: 'line' | 'live' = 'live';
          
          try {
            const game = await this.prismaService.game.findUnique({
              where: { eventId: eventId.toString() },
              select: { status: true }
            });
            
            if (game) {
              // Если игра имеет статус PREMATCH, используем 'line', иначе 'live'
              dataType = game.status === 'PREMATCH' ? 'line' : 'live';
              this.logger.debug(`Game ${eventId} has status ${game.status}, using dataType: ${dataType}`);
            } else {
              this.logger.debug(`Game ${eventId} not found in database, defaulting to dataType: live`);
            }
          } catch (dbError) {
            this.logger.warn(`Error checking game status for ${eventId}, defaulting to dataType: live`, dbError.message);
          }

          // Используем правильный эндпоинт для получения данных sub-games
          const requestURL = `/event/${eventId}/sub`;
          const response = await this.request<BetApiEventResponse>(requestURL, dataType, this.dataLang);
          this.logger.debug(`Fetched sub-game data for event ${eventId} from /sub with dataType: ${dataType}`);
          return response;
        } catch (err) {
          this.logger.error(`Error fetching sub-game for event ${eventId}: ${err.message}`);
          return { status: 1, body: {} as GameBetApi, page: '' };
        }
      };

      const { data } = await this.getCachedData<BetApiEventResponse>(
        cacheKey,
        fetchData,
        300000 // 5 minutes cache for sub-games
      );

      return data;
    } catch (error) {
      this.logger.error(`Error fetching sub-game data for event ${eventId}:`, error);
      return { status: 1, body: {} as GameBetApi, page: '' };
    }
  }

  async fetchDetailedEventData(eventId: string | number): Promise<BetApiEventResponse> {
    const cacheKey = `detailed_event_data:${eventId}`;

    try {
      const fetchData = async (): Promise<BetApiEventResponse> => {
        try {
          // Используем /sub/line эндпоинт для получения детальных данных
          const requestURL = `/event/${eventId}/sub/line`;
          const response = await this.request<BetApiEventResponse>(requestURL, 'line', this.dataLang);
          this.logger.debug(`Fetched detailed event data for event ${eventId} from /sub/line`);
          return response;
        } catch (err) {
          this.logger.error(`Error fetching detailed event data for event ${eventId}: ${err.message}`);
          return { status: 1, body: {} as GameBetApi, page: '' };
        }
      };

      const { data } = await this.getCachedData<BetApiEventResponse>(
        cacheKey,
        fetchData,
        300000 // 5 minutes cache for detailed event data
      );

      return data;
    } catch (error) {
      this.logger.error(`Error fetching detailed event data for event ${eventId}:`, error);
      return { status: 1, body: {} as GameBetApi, page: '' };
    }
  }

  async fetchEventData(eventId: string | number): Promise<BetApiEventResponse> {
    const cacheKey = `event_data:${eventId}`;
    const now = Date.now();

    if (this.apiStats.isCircuitOpen) {
      this.logger.debug(`Circuit breaker is open, returning empty data for event ${eventId}`);
      return { status: 1, body: {} as GameBetApi, page: '' };
    }

    // Проверяем минимальный интервал между запросами
    if (
      this.eventLastFetch[eventId] &&
      now - this.eventLastFetch[eventId] < this.EVENT_MIN_INTERVAL
    ) {
      // Если запрос уже в процессе - ждем его
      if (this.eventInFlight[eventId]) {
        return this.eventInFlight[eventId];
      }
      // Если есть в кеше - возвращаем из кеша
      const cachedData = this.eventCache.get(cacheKey);
      if (cachedData) {
        return cachedData.data;
      }
      return { status: 1, body: {} as GameBetApi, page: '' };
    }

    // Если запрос уже в процессе - ждем его
    if (this.eventInFlight[eventId]) {
      return this.eventInFlight[eventId];
    }

    // Создаем новый запрос
    this.eventInFlight[eventId] = (async () => {
      try {
        const fetchData = async (): Promise<BetApiEventResponse> => {
          try {
            // Основной запрос - пробуем разные эндпоинты для получения полного game_oc_list
            let response: BetApiEventResponse;

            // Сначала пробуем /sub эндпоинт
            try {
              const requestURL = `/event/${eventId}/sub`;
              response = await this.request<BetApiEventResponse>(requestURL, 'line', this.dataLang);

              // Универсальная проверка для разных форматов ответов /sub эндпоинта
              if (response && response.body) {
                const body = response.body as any; // Используем any для гибкости с разными форматами

                // Добавляем детальное логирование для понимания структуры
                this.logger.debug(`/sub endpoint response structure for event ${eventId}:`, {
                  isArray: Array.isArray(body),
                  bodyKeys: typeof body === 'object' ? Object.keys(body) : 'not object',
                  bodyType: typeof body,
                  hasEvent: body?.event ? 'yes' : 'no',
                  hasEventsList: body?.events_list ? 'yes' : 'no',
                  hasGameOcList: body?.game_oc_list ? 'yes' : 'no',
                  eventKeys: body?.event ? Object.keys(body.event) : 'no event',
                  eventHasGameOcList: body?.event?.game_oc_list ? 'yes' : 'no'
                });

                // Случай 1: Массив объектов (как у /list)
                if (Array.isArray(body) && body.length > 0) {
                  const gameData = body[0];
                  if (gameData && gameData.game_oc_list && Array.isArray(gameData.game_oc_list) && gameData.game_oc_list.length > 0) {
                    const firstItem = gameData.game_oc_list[0];
                    if (firstItem && typeof firstItem === 'object' && Object.keys(firstItem).length > 0) {
                      this.logger.debug(`Successfully got data from /sub endpoint (array format) for event ${eventId}`);
                      return response;
                    }
                  }
                }
                // Случай 2: Одиночный объект event (специфичный для /sub)
                else if (body.event && typeof body.event === 'object') {
                  const event = body.event;
                  if (event.game_oc_list && Array.isArray(event.game_oc_list) && event.game_oc_list.length > 0) {
                    const firstItem = event.game_oc_list[0];
                    if (firstItem && typeof firstItem === 'object' && Object.keys(firstItem).length > 0) {
                      this.logger.debug(`Successfully got data from /sub endpoint (single event format) for event ${eventId}`);
                      // Преобразуем в массив для совместимости с остальным кодом
                      (response as any).body = [event];
                      return response;
                    }
                  }
                }
                // Случай 3: Объект с events_list (как у /list но один турнир)
                else if (body.events_list && Array.isArray(body.events_list)) {
                  this.logger.debug(`Successfully got data from /sub endpoint (events_list format) for event ${eventId}`);
                  // Преобразуем в массив для совместимости
                  (response as any).body = [body];
                  return response;
                }
                // Случай 4: Прямой объект с game_oc_list (возможный формат /sub)
                else if (body.game_oc_list && Array.isArray(body.game_oc_list) && body.game_oc_list.length > 0) {
                  const firstItem = body.game_oc_list[0];
                  if (firstItem && typeof firstItem === 'object' && Object.keys(firstItem).length > 0) {
                    this.logger.debug(`Successfully got data from /sub endpoint (direct game_oc_list format) for event ${eventId}`);
                    // Преобразуем в массив для совместимости
                    (response as any).body = [body];
                    return response;
                  }
                }
              }

              this.logger.debug(`/sub endpoint returned empty or invalid data for event ${eventId}, trying /list endpoint`);
            } catch (subError) {
              this.logger.warn(`/sub endpoint failed for event ${eventId}: ${subError.message}, trying /list endpoint`);
            }

            // Если /sub не работает, пробуем /list эндпоинт
            try {
              const requestURL = `/event/${eventId}/list`;
              response = await this.request<BetApiEventResponse>(requestURL, 'live', this.dataLang);
              this.logger.debug(`Using /list endpoint for event ${eventId}`);
            } catch (listError) {
              this.logger.error(`All endpoints (/sub, /list) failed for event ${eventId}`);
              throw listError;
            }

            return response;
          } catch (err) {
            this.logger.error(`Error in fetchData for event ${eventId}: ${err.message}`);
            return { status: 1, body: {} as GameBetApi, page: '' };
          }
        };

        const { data, source } = await this.getCachedData<BetApiEventResponse>(
          cacheKey,
          fetchData,
          CACHE_TTL
        );

        // Обновляем время последнего запроса
        this.eventLastFetch[eventId] = Date.now();

        if (source === 'API') {
          // Если получили новые данные - обновляем кеш
          this.eventCache.set(cacheKey, {
            data,
            expiry: Date.now() + CACHE_TTL,
            source: 'API',
            timestamp: Date.now(),
          });
        }

        return data;
      } catch (error) {
        this.logger.error(`Error fetching event data for event ID ${eventId}:`, error);
        return { status: 1, body: {} as GameBetApi, page: '' };
      } finally {
        delete this.eventInFlight[eventId];
      }
    })();

    return this.eventInFlight[eventId];
  }

  async checkFinishedGames() {
    const finishedGames = await this.prismaService.game.findMany({
      where: { status: 'IN_PROGRESS', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
      take: 50,
    });
    const eventIds = finishedGames.map(g => g.eventId);
    const responses = await this.fetchAllEvents(eventIds);
  }

  async finaleGames() {
    const startTime = Date.now();
    this.logger.info(`[DEBUG] finaleGames started at ${new Date().toISOString()}`);
    
    try {
      // Находим игры, которые не обновлялись более 5 минут
      const records = await this.prismaService.$queryRaw<
        { eventId: string }[]
      >` SELECT "eventId" FROM "Game" 
         WHERE status = 'IN_PROGRESS' 
         AND EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 60 > 10
         ORDER BY "updatedAt" ASC
         LIMIT 75;`;

      this.logger.info(`[DEBUG] Found ${records?.length || 0} stale games: ${records?.map(r => r.eventId).join(', ') || 'none'}`);

      if (!records || records.length === 0) {
        this.logger.info(`No stale games found - Duration: ${Date.now() - startTime}ms`);
        return;
      }

      const gameIds = records.map((_) => _.eventId);
      
      // ИСПРАВЛЕНИЕ: Исключаем subgame eventIds из обработки
      // Проверяем, какие из eventIds являются subgames
      const subGameEventIds = await this.prismaService.subGame.findMany({
        where: { subEventId: { in: gameIds } },
        select: { subEventId: true }
      });
      
      const subGameEventIdSet = new Set(subGameEventIds.map(sg => sg.subEventId));
      const filteredGameIds = gameIds.filter(eventId => !subGameEventIdSet.has(eventId));
      
      if (subGameEventIdSet.size > 0) {
        this.logger.info(`[DEBUG] Filtered out ${subGameEventIdSet.size} subgame eventIds from finaleGames: ${Array.from(subGameEventIdSet).join(', ')}`);
      }
      
      if (filteredGameIds.length === 0) {
        this.logger.info(`No regular games to process after filtering subgames - Duration: ${Date.now() - startTime}ms`);
        return;
      }
      
      // this.logger.info(`Checking status for ${filteredGameIds.length} games: ${filteredGameIds.join(', ')}`);

      const fetchStartTime = Date.now();
      try {
        const responses = await this.fetchAllEvents(filteredGameIds);
        const fetchDuration = Date.now() - fetchStartTime;
        this.logger.info(`Fetched data for ${filteredGameIds.length} games - Duration: ${fetchDuration}ms`);

        const cancelIds = [];
        const finishIds = [];

        const notFoundGames = [];
        const invalidDataGames = [];

        // ОПТИМИЗАЦИЯ: Получаем все существующие игры одним запросом
          const existingGamesMap = new Map();
          const existingGames = await this.prismaService.game.findMany({
            where: { eventId: { in: filteredGameIds } },
            select: { eventId: true }
          });
          existingGames.forEach(game => existingGamesMap.set(game.eventId, true));

          // ОПТИМИЗАЦИЯ: Получаем количество активных ставок для всех игр одним запросом
          const activeBetsMap = new Map();
          const activeBetsData = await this.prismaService.bet.groupBy({
            by: ['gameId'],
            where: {
              gameId: { in: filteredGameIds },
              status: BetStatus.PENDING
            },
            _count: { id: true }
          });
          activeBetsData.forEach(bet => {
            activeBetsMap.set(bet.gameId, bet._count.id);
          });

        // Обрабатываем каждую игру (теперь без дополнительных запросов к БД)
         Object.keys(responses).forEach((eventId) => {
           const res = responses[eventId];
           const now = Date.now();
           const existingGame = existingGamesMap.get(eventId);
           const hasActiveBets = activeBetsMap.get(eventId) || 0;

          if (!res || res.error || res.status !== 1 || !res.body || !res.body.length) {
            // Игра не найдена в API - скорее всего завершилась
            // Автоматически завершаем игру, если она существует в БД
            if (existingGame) {
              finishIds.push(eventId);
            } else {
              notFoundGames.push(eventId);
            }
            return;
          }

          const game = res.body[0];
          if (!game || typeof game !== 'object') {
            invalidDataGames.push(eventId);
            return;
          }

          // Более строгие условия для определения завершенной игры
          const finaleCheck = game.hasOwnProperty('finale') && game.finale === true;
          const statusCheck = game.hasOwnProperty('status') && (game.status === 'FINISHED' || game.status === 2);
          // Убираем проверку по таймеру FT/Final - она слишком агрессивная
          // const timerCheck = game.hasOwnProperty('timer') && game.timer && typeof game.timer === 'string' && (game.timer.includes('FT') || game.timer.includes('Final'));
          const timeCheck = game.hasOwnProperty('game_start') && (now - game.game_start * 1000) > 6 * 60 * 60 * 1000; // Увеличиваем до 6 часов
          
          const isFinished = finaleCheck || statusCheck || timeCheck;
          
          // Логируем детали для отладки
          if (isFinished) {
            this.logger.debug(`Game ${eventId} marked as finished - finale: ${finaleCheck}, status: ${statusCheck} (${game.status}), time: ${timeCheck}, hasActiveBets: ${hasActiveBets}`);
          }

          // Проверяем, не отменена ли игра официально
          const isCanceled =
            (game.hasOwnProperty('status') && (game.status === 'CANCELED' || game.status === 3)) ||
            (game.hasOwnProperty('canceled') && game.canceled === true);

          if (isFinished) {
            // Если есть активные ставки, не помечаем как завершенную
            if (hasActiveBets > 0) {
              this.logger.debug(`Game ${eventId} has ${hasActiveBets} active bets, keeping as IN_PROGRESS`);
              return;
            }

            finishIds.push(eventId);
            // Логируем только если есть активные ставки, чтобы уменьшить количество логов
            if (hasActiveBets) {
              this.logger.warn(`Marking game ${eventId} as FINISHED with active bets - ${JSON.stringify({
                finale: game.finale,
                status: game.status,
                score: game.score_full,
                timer: game.timer,
                activeBets: hasActiveBets
              })}`);
            }
          } else if (isCanceled) {
            // Только отменяем, если игра официально отменена
            cancelIds.push(eventId);
          }
          // Для активных игр обновление времени будет выполнено batch-запросом ниже
        });

        // ОПТИМИЗАЦИЯ: Batch-обновление времени для всех существующих игр
        const gamesToUpdate = gameIds.filter(eventId => 
          existingGamesMap.has(eventId) && 
          !finishIds.includes(eventId) && 
          !cancelIds.includes(eventId)
        );
        
        if (gamesToUpdate.length > 0) {
          await this.withDeadlockRetry(
            () => this.prismaService.game.updateMany({
              where: { eventId: { in: gamesToUpdate } },
              data: { updatedAt: new Date() }
            }),
            'game.updateMany(updatedAt)'
          );
        }

        // Обновляем статусы игр
        if (cancelIds.length > 0) {
          await this.withDeadlockRetry(
            () => this.prismaService.game.updateMany({
              where: { eventId: { in: cancelIds } },
              data: {
                status: 'CANCELED',
                updatedAt: new Date()
              }
            }),
            'game.updateMany(cancel)'
          );
          this.logger.warn(`Marked ${cancelIds.length} games as CANCELED`);

          // Отправляем WebSocket уведомления об отмене игр
          try {
            for (const eventId of cancelIds) {
              // Отправляем групповое обновление для главной страницы
              this.eventGateway.sendGroupUpdate({
                eventId,
                type: 'gameStatusUpdate',
                payload: {
                  eventId,
                  status: 'CANCELED',
                  updatedAt: new Date().toISOString()
                }
              });

              // Отправляем детальное обновление для страницы конкретной игры
              this.eventGateway.sendDetailedUpdate({
                eventId,
                type: 'gameStatusUpdate',
                payload: {
                  eventId,
                  status: 'CANCELED',
                  updatedAt: new Date().toISOString()
                }
              });

            }
          } catch (error) {
            this.logger.error('Error sending WebSocket notifications for canceled games:', error);
          }
        }

        if (finishIds.length > 0) {
          await this.withDeadlockRetry(
            () => this.prismaService.game.updateMany({
              where: { eventId: { in: finishIds } },
              data: {
                status: 'FINISHED',
                updatedAt: new Date()
              }
            }),
            'game.updateMany(finished)'
          );
          this.logger.warn(`Marked ${finishIds.length} games as FINISHED`);

          // Отправляем WebSocket уведомления о завершении игр
          try {
            for (const eventId of finishIds) {
              // Отправляем групповое обновление для главной страницы
              this.eventGateway.sendGroupUpdate({
                eventId,
                type: 'gameStatusUpdate',
                payload: {
                  eventId,
                  status: 'FINISHED',
                  updatedAt: new Date().toISOString()
                }
              });

              // Отправляем детальное обновление для страницы конкретной игры
              this.eventGateway.sendDetailedUpdate({
                eventId,
                type: 'gameStatusUpdate',
                payload: {
                  eventId,
                  status: 'FINISHED',
                  updatedAt: new Date().toISOString()
                }
              });

            }
          } catch (error) {
            this.logger.error('Error sending WebSocket notifications for finished games:', error);
          }

          // Автоматически обрабатываем зависшие ставки для завершенных игр
          try {
            // TODO: Implement bet processing logic in betapi integration
            this.logger.warn(`Processed stuck bets for ${finishIds.length} finished games`);
          } catch (error) {
            this.logger.error('Error processing stuck bets after finishing games:', error);
          }
        }

        // Consolidated logging for problematic games
        if (notFoundGames.length > 0) {
          this.logger.warn(`${notFoundGames.length} games not found in API (not in DB) - skipping: ${notFoundGames.slice(0, 5).join(', ')}${notFoundGames.length > 5 ? ` and ${notFoundGames.length - 5} more` : ''}`);
        }

        if (invalidDataGames.length > 0) {
          this.logger.warn(`${invalidDataGames.length} games have invalid data - keeping for manual review: ${invalidDataGames.slice(0, 5).join(', ')}${invalidDataGames.length > 5 ? ` and ${invalidDataGames.length - 5} more` : ''}`);
        }

      } catch (error) {
        this.logger.error(
          `Error processing game status updates - Duration: ${Date.now() - startTime}ms:`,
          error,
          { stack: error.stack }
        );
      }

      const totalDuration = Date.now() - startTime;
      this.logger.warn(`Completed finaleGames - Total duration: ${totalDuration}ms`);
    } catch (error) {
      this.logger.error(
        `Error in finaleGames - Duration: ${Date.now() - startTime}ms:`,
        error,
        { stack: error.stack }
      );
    }
  }

  async getCountries(
    sportId: number = 0,
    dataType: 'line' | 'live' = 'line',
  ): Promise<BetApiCountry[]> {
    return this.countries[dataType].filter(
      (_) => sportId == 0 || _.sport_id == sportId,
    );
  }

  async getEvents(
    sportId: number = 0,
    tournamentId: number = 0,
    dataType: 'line' | 'live' = 'line',
  ): Promise<GameBetApi[]> {
    // Validate sport ID if provided
    if (sportId !== 0 && !this.supportedSportIds.includes(sportId)) {
      this.logger.warn(`Unsupported sport ID requested: ${sportId}`);
      return [];
    }

    const where: Prisma.GameBetApiWhereInput = {
      type: dataType.toUpperCase() as GameBetApiType,
    };

    if (sportId !== 0) {
      where.sport_id = sportId;
    }

    if (tournamentId !== 0) {
      where.tournament_id = tournamentId;
    }

    return this.prismaService.gameBetApi.findMany({
      where,
      take: 100,
    });
  }


  async getEventsByIdsFromBetApi(eventIds: number[]): Promise<any> {
    const startTime = Date.now();
    const eventsToFetch = [];
    const cachedResults = [];

    for (const eventId of eventIds) {
      const cacheKey = `event_data:${eventId}`;
      const cachedItem = this.eventCache.get(cacheKey);

      if (
        cachedItem &&
        (Date.now() < cachedItem.expiry ||
          Date.now() < cachedItem.timestamp + 5000)
      ) {
        const cachedData = cachedItem.data;
        if (cachedData && 'body' in cachedData) {
          cachedResults.push(cachedData.body);
        }
      } else {
        eventsToFetch.push(eventId);
      }
    }

    if (eventsToFetch.length === 0) {
      const duration = Date.now() - startTime;
      this.logger.debug(`All ${eventIds.length} events found in cache - Duration: ${duration}ms`);
      return cachedResults;
    }

    const batchSize = 20;
    const processBatch = async (batch: number[]) => {
      const batchStartTime = Date.now();
      // Убираем лишний лог о начале обработки батча

      const batchPromises = batch.map(eventId => this.fetchEventData(eventId));
      try {
        const results = await Promise.all(batchPromises);

        const batchDuration = Date.now() - batchStartTime;
        const validResults = results.filter(r => {
          return r && !('error' in r) && 'status' in r && r.status === 1 && 'body' in r;
        });
        // Логируем только если были ошибки или операция была длительной
        if (validResults.length < batch.length || batchDuration > 1000) {
          this.logger.warn(`Completed batch of ${batch.length} events - Success: ${validResults.length}, Failed: ${batch.length - validResults.length} - Duration: ${batchDuration}ms`);
        }
        return validResults.map(r => 'body' in r ? r.body : null).filter(b => b !== null && b !== undefined);
      } catch (error) {
        const batchDuration = Date.now() - batchStartTime;
        this.logger.error(`Failed batch of ${batch.length} events - Duration: ${batchDuration}ms:`, error);
        return [];
      }
    };

    const batches = [];
    for (let i = 0; i < eventsToFetch.length; i += batchSize) {
      batches.push(eventsToFetch.slice(i, i + batchSize));
    }

    try {
      let allFetchedResults = [];
      for (let i = 0; i < batches.length; i++) {
        const batchResults = await processBatch(batches[i]);
        allFetchedResults = allFetchedResults.concat(batchResults);
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const allResults = cachedResults.concat(allFetchedResults);
      const duration = Date.now() - startTime;
      this.logger.debug(
        `Completed getEventsByIdsFromBetApi - Total: ${eventIds.length}, Cached: ${cachedResults.length}, Fetched: ${allFetchedResults.length} - Duration: ${duration}ms`
      );
      return allResults;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed getEventsByIdsFromBetApi - Duration: ${duration}ms:`, error);
      if (cachedResults.length > 0) {
        this.logger.info(`Returning ${cachedResults.length} cached results despite error`);
        return cachedResults;
      }
      return [];
    }
  }

  async getSports(dataType: 'line' | 'live' = 'line'): Promise<BetApiSport[]> {
    // Filter sports based on supported IDs
    return this.sports[dataType].filter(sport =>
      this.supportedSportIds.includes(sport.id)
    );
  }

  async getTournaments(
    sportId: number = 0,
    countryId: number = 0,
    dataType: 'line' | 'live' = 'line',
  ): Promise<BetApiCountry[]> {
    return this.tournaments[dataType].filter(
      (_) =>
        (sportId == 0 || _.sport_id == sportId) &&
        (countryId == 0 || _.country_id == countryId),
    );
  }

  hasChanges(
    prev: GameBetApi | null,
    current: GameBetApi | null,
    only: string[] = [],
    exclude: string[] = [],
  ): boolean {
    if (!prev) return current !== null;
    if (!current) return true;

    const keys = Object.keys(current);
    for (const key of keys) {
      if (exclude.includes(key)) continue;
      if (!only.includes(key)) continue;
      try {
        if (prev[key as keyof GameBetApi] !== current[key as keyof GameBetApi]) {
          return true;
        }
      } catch (e) {
        this.logger.error('Error: ', [e, prev, current]);
        return false;
      }
    }

    return false;
  }

  async onModuleInit() {
    this.wsAdapter.connect();

    // Оптимизируем интервал логирования - увеличиваем интервал и уменьшаем частоту
    setInterval(() => {
      if (this.apiStats.totalRequests % 500 === 0) {
        const wsStatus = this.wsAdapter.getStatus();
        const perfStats = this.changeDetector.getPerformanceStats();

        this.logger.warn(
          `Status: Cache=${this.eventCache.size}, WS=${wsStatus.connected}, Buffer=${wsStatus.bufferSize}, Queue=${wsStatus.queueSize}, Priority=${perfStats.priorityEventsCount}, Interval=${perfStats.currentInterval}ms`
        );
      }
    }, 120000);

    const enabled = this.configService.get('BETAPI_ENABLED');
    if (enabled === 'true' || enabled === true) {
      await this.startUpdateEventsTask();
    }
  }

  prepareGameDataFromEvent(event: GameBetApi) {
    const data = {
      country_id: event.country_id,
      country_name: event.country_name,
      eventId: String(event.game_id),
      eventName: event.opp_1_name + ' vs ' + event.opp_2_name,
      ext_game_id: event.ext_game_id,
      extra_time: event.extra_time,
      finale: event.finale,
      game_desk: event.game_desk,
      game_dop_name: event.game_dop_name,
      game_dop_name_langs: {},
      game_id: event.game_id,
      game_mid: event.game_mid,
      game_num: event.game_num,
      game_oc_counter: event.game_oc_counter,
      game_oc_list: event.game_oc_list,
      game_oc_list_id: event.game_oc_list_id,
      game_plan: event.game_plan,
      game_start: event.game_start,
      leagueName: event.tournament_name,
      opp_1_icon: event.hasOwnProperty('opp_1_icon') ? event.opp_1_icon : '',
      opp_1_id: event.opp_1_id,
      opp_1_ids: event.opp_1_ids,
      opp_1_name: event.opp_1_name,
      opp_1_name_langs: {},
      opp_2_icon: event.hasOwnProperty('opp_2_icon') ? event.opp_2_icon : '',
      opp_2_id: event.opp_2_id,
      opp_2_ids: event.opp_2_ids,
      opp_2_name: event.opp_2_name,
      opp_2_name_langs: {},
      period_name: event.period_name,
      pitch: String(event.pitch),
      priority: event.priority,
      score_extra: event.score_extra,
      score_full: event.score_full,
      score_period: event.score_period,
      sgame_id: String(event.sgame_id),
      sport: BetApiTransformService.BetApiSportIdToName(event.sport_id),
      sport_id: event.sport_id,
      sport_name: event.sport_name,
      sport_name_langs: {},
      stat_id: String(event.stat_id),
      stat_list: event.stat_list,
      stat_list_extra: event.stat_list_extra,
      status: GameStatus.IN_PROGRESS,
      timer: event?.timer ?? 0,
      tournament_id: event.tournament_id,
      tournament_name: event.tournament_name,
      tournament_name_langs: {},
      type: GameBetApiType.LIVE,
    };

    return data;
  }
  async processGameOcList() {
    const gameBets = await this.prismaService.gameBetApi.findMany({
      select: {
        game_oc_list: true,
        sport_id: true,
      },
      where: {
        sport_id: 3,
      },
    });

    const allOcLists = gameBets
      .flatMap((gameBet) =>
        (gameBet.game_oc_list as any[]).map((ocList) => {
          const pointerStr = (ocList as unknown as EventOcList)
            .oc_pointer as unknown as string;
          const pointer = pointerStr.split('|');
          ocList['oc_group_id'] = pointer[1];
          ocList['oc_sub_group_id'] = pointer[2];
          ocList['oc_result'] = pointer[3];
          delete ocList['oc_pointer'];
          delete ocList['oc_rate'];
          delete ocList['oc_block'];
          return ocList;
        }),
      )
      .filter(
        (obj, idx, arr) =>
          idx ===
          arr.findIndex(
            (t) =>
              t.oc_group_id === obj.oc_group_id &&
              t.oc_sub_group_id === obj.oc_sub_group_id &&
              t.oc_result === obj.oc_result,
          ),
      );

    const groupedBySecondNumber = allOcLists.reduce(
      (acc, oc) => {
        const secondNumber = oc.oc_group_id;
        if (!acc[secondNumber]) {
          acc[secondNumber] = [];
        }
        acc[secondNumber].push(oc);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return groupedBySecondNumber;
  }

  async saveEvents(eventsKey: string, dataType: 'line' | 'live' = 'live') {
    const startTime = Date.now();
    const events = this.events[eventsKey];
    const totalEvents = events.size;
    
    if (totalEvents === 0) {
      // Убираем лишние логи для пустых событий
      return;
    }

    // Логируем только если много событий
    if (totalEvents > 50) {
      this.logger.warn(`Starting saveEvents for ${eventsKey} with ${totalEvents} events`);
    }

    try {
      const eventsArray = Array.from(events.values());
      // Оптимизированный размер батча: 50-100 событий для лучшей производительности
      const batchSize = Math.min(100, Math.max(50, Math.ceil(totalEvents / Math.ceil(totalEvents / 75))));
      const batches = [];

      for (let i = 0; i < eventsArray.length; i += batchSize) {
        batches.push(eventsArray.slice(i, i + batchSize));
      }
      // console.log('batches', batches[0][0]);

      // Убираем лишний лог о начале обработки событий

      let processedCount = 0;
      let skippedCount = 0;

      // Параллельная обработка батчей для улучшения производительности
      const maxConcurrentBatches = Math.min(3, Math.max(1, Math.ceil(batches.length / 4))); // Ограничиваем до 3 параллельных батчей
      const batchPromises: Promise<{ success: boolean; batchIndex: number; batchSize: number; duration: number }>[] = [];

      for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
        const currentBatchGroup = batches.slice(i, i + maxConcurrentBatches);
        
        const groupPromises = currentBatchGroup.map(async (batch, groupIndex) => {
          const batchIndex = i + groupIndex;
          const batchStartTime = Date.now();

          try {
            // Увеличиваем таймаут для больших батчей (50-100 событий)
            await Promise.race([
              this.processBatchOptimized(batch, batchIndex, batches.length, dataType),
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Batch timeout')), 30000); // Увеличиваем таймаут до 30 секунд для больших батчей
              })
            ]);

            const batchDuration = Date.now() - batchStartTime;
            
            // Логируем только длительные операции
            if (batchDuration > 2000) {
              this.logger.warn(`Batch ${batchIndex + 1}/${batches.length}: Completed in ${batchDuration}ms`);
            } else if (batchDuration > 1000) {
              this.logger.debug(`Batch ${batchIndex + 1}/${batches.length}: Completed in ${batchDuration}ms`);
            }

            return { success: true, batchIndex, batchSize: batch.length, duration: batchDuration };
          } catch (error) {
            const batchDuration = Date.now() - batchStartTime;
            
            // Логируем только если это не таймаут или другая ожидаемая ошибка
            if (!error.message.includes('timeout') && !error.message.includes('ECONNRESET')) {
              this.logger.warn(`Batch ${batchIndex + 1} failed: ${error.message}`);
            } else {
              this.logger.debug(`Batch ${batchIndex + 1} timed out: ${error.message}`);
            }
            
            // Логируем превышение времени только если оно значительное
            if (batchDuration > 2000) {
              this.logger.warn(`Batch ${batchIndex + 1} exceeded 2 seconds: ${batchDuration}ms`);
            } else {
              this.logger.debug(`Batch ${batchIndex + 1} took: ${batchDuration}ms`);
            }

            return { success: false, batchIndex, batchSize: batch.length, duration: batchDuration };
          }
        });

        // Ждем завершения текущей группы батчей
        const groupResults = await Promise.all(groupPromises);
        
        // Подсчитываем результаты
        groupResults.forEach(result => {
          if (result.success) {
            processedCount += result.batchSize;
          } else {
            skippedCount += result.batchSize;
          }
        });

        // Небольшая пауза между группами батчей для снижения нагрузки на БД
        if (i + maxConcurrentBatches < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      const totalDuration = Date.now() - startTime;
      
      // Отслеживаем производительность
      this.trackPerformance('saveEvents', totalDuration);
      
      // Логируем только если операция была длительной или были пропущенные события
      if (totalDuration > 5000 || skippedCount > 0) {
        this.logger.warn(`Completed saveEvents for ${eventsKey} - Total duration: ${totalDuration}ms`, [{
          totalEvents,
          processed: processedCount,
          skipped: skippedCount,
          duration: totalDuration
        }]);
      }

      // Логируем статистику производительности каждые 50 вызовов
      if (this.performanceMetrics.saveEvents.calls % 50 === 0) {
        this.logPerformanceStats();
      }

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`Error in saveEvents for ${eventsKey}:`, error);
      // Убираем дублирующий лог при ошибке
    }
  }

  // Оптимизированный метод для обработки батча
  private async processBatchOptimized(batch: GameBetApi[], batchIndex: number, totalBatches: number, dataType: 'line' | 'live') {
    const batchStartTime = Date.now();
    const oddsDataType = dataType === 'line' ? 'prematch' : 'live';

    try {
      const processedItems = [];
      const existingGames = new Map();
      const gameUpdates = [];
      const marketUpdates = [];
      const webSocketMessages = [];

      // Предварительно получаем существующие игры для батча с оптимизированным запросом
      // Исключаем subgames (game_id != game_mid) из запроса к базе данных
      const eventIds = batch
        .filter(event => event.game_id === event.game_mid) // Только обычные игры, НЕ subgames
        .map(event => event.game_id)
        .filter(id => id != null)
        .map(id => String(id));
      if (eventIds.length > 0) {
        const dbQueryStart = Date.now();
        const existingGamesData = await this.prismaService.game.findMany({
          where: {
            eventId: { in: eventIds }
            // Убираем фильтрацию по статусу, так как на главной странице могут быть игры с любыми статусами
          },
          select: { 
            eventId: true, 
            meta: true, 
            status: true,
            updatedAt: true // Добавляем для проверки свежести данных
          }
        });
        const dbQueryDuration = Date.now() - dbQueryStart;
        
        // Отслеживаем производительность DB запросов
        this.trackPerformance('dbQueries', dbQueryDuration);
        
        // Логируем медленные запросы
        if (dbQueryDuration > 800) {
          this.logger.warn(`Slow DB query detected: ${dbQueryDuration}ms for ${eventIds.length} events`);
        }

        existingGamesData.forEach(game => {
          existingGames.set(game.eventId, game);
        });
      }

      // Обрабатываем события в батче
      for (const event of batch) {
        if (event.game_id != event.game_mid) {
          this.logger.debug('SUB Game found: ', [event.game_id, event.game_mid]);
          // Обрабатываем subgame только через processSubGame, НЕ добавляем в processedItems
          await this.processSubGame(event, dataType);
          continue;
        }

        try {
          const data = this.prepareGameDataFromEvent(event);
          const gameInput = BetApiTransformService.eventToGameInput(
            event,
            oddsDataType,
          );

          // Проверяем существующую игру из кэша
          const existingGame = existingGames.get(data.eventId);

          if (existingGame) {
            const updatedMeta = {
              ...(existingGame.meta as any || {}),
              ...(gameInput.meta as any || {}),
              [`last_${dataType}_update`]: new Date().toISOString(),
              groupedMarkets: BetApiTransformService.ocToGroupedMarkets(event)
            };

            // Собираем обновления для батчевой обработки (только для обычных игр, НЕ subgames)
            gameUpdates.push({
              where: { eventId: data.eventId },
              data: {
                score: gameInput.score,
                status: gameInput.status as GameStatus,
                meta: updatedMeta,
                updatedAt: new Date()
              }
            });

            // Собираем обновления рынков для батчевой обработки
            if (event.game_oc_list && Array.isArray(event.game_oc_list) && event.game_oc_list.length > 0) {
              const rawMarkets = BetApiTransformService.PrepareOsList(event);
              marketUpdates.push({
                eventId: data.eventId,
                markets: rawMarkets as any,
                updatedAt: new Date()
              });
            }

            // Собираем WebSocket сообщения для батчевой отправки
            webSocketMessages.push({
              type: 'update_event_full',
              eventId: data.eventId,
              data: {
                event: { ...gameInput, eventId: data.eventId },
                score: BetApiTransformService.eventToODDSScoreString(event),
                markets: BetApiTransformService.ocToGroupedMarkets(event)
              }
            });

            continue;
          }

          // Добавляем в processedItems только обычные игры (НЕ subgames)
          processedItems.push({
            event,
            eventId: data.eventId,
            gameInput,
            markets: BetApiTransformService.ocToGroupedMarkets(event),
          });
        } catch (error) {
          this.logger.error('Error processing event:', {
            error: error.message,
            eventId: event.game_id
          });
        }
      }

      // Выполняем батчевые операции с базой данных
      const dbOperationsStart = Date.now();
      
      // Батчевое обновление игр с использованием upsert для создания отсутствующих записей
      if (gameUpdates.length > 0) {
        try {
          await Promise.all(
            gameUpdates.map(update => {
              // Находим соответствующее событие из батча для получения данных
              const eventData = batch.find(event => event.game_id.toString() === update.where.eventId);
              const gameData = eventData ? this.prepareGameDataFromEvent(eventData) : null;
              
              return this.prismaService.game.upsert({
                where: update.where,
                update: update.data,
                create: {
                  eventId: update.where.eventId,
                  eventName: gameData?.eventName || 'Unknown Event',
                  leagueName: gameData?.leagueName || 'Unknown League',
                  sport: gameData?.sport || 'Unknown Sport',
                  team1: gameData?.opp_1_name || 'Team 1',
                  team2: gameData?.opp_2_name || 'Team 2',
                  score: update.data.score || '0:0',
                  status: update.data.status,
                  meta: update.data.meta,
                  priority: gameData?.priority || 0,
                  createdAt: new Date(),
                  updatedAt: update.data.updatedAt
                }
              }).catch(error => {
                this.logger.error(`Failed to upsert game ${update.where.eventId}:`, error.message);
              });
            })
          );
        } catch (error) {
          this.logger.error('Batch game upserts failed:', error.message);
        }
      }

      // Батчевое обновление рынков
      if (marketUpdates.length > 0) {
        try {
          await Promise.all(
            marketUpdates.map(async (update) => {
              try {
                // Ensure parent Game exists to satisfy FK before markets upsert
                const gameData = (() => {
                  const eventData = batch.find(event => event.game_id.toString() === update.eventId);
                  return eventData ? this.prepareGameDataFromEvent(eventData) : undefined;
                })();

                await this.prismaService.game.upsert({
                  where: { eventId: update.eventId },
                  update: { updatedAt: new Date() },
                  create: {
                    eventId: update.eventId,
                    eventName: gameData?.eventName || 'Unknown Event',
                    leagueName: gameData?.leagueName || 'Unknown League',
                    sport: gameData?.sport || 'Unknown Sport',
                    team1: gameData?.opp_1_name || 'Team 1',
                    team2: gameData?.opp_2_name || 'Team 2',
                    score: '0:0',
                    status: 'IN_PROGRESS',
                    meta: {},
                    priority: gameData?.priority || 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }
                });

                await this.prismaService.gameMarkets.upsert({
                  where: { eventId: update.eventId },
                  create: {
                    eventId: update.eventId,
                    markets: update.markets
                  },
                  update: {
                    markets: update.markets,
                    updatedAt: update.updatedAt
                  }
                });
              } catch (error: any) {
                this.logger.error(`Failed to update markets for ${update.eventId}:`, error?.message || error);
              }
            })
          );
        } catch (error) {
          this.logger.error('Batch market updates failed:', error.message);
        }
      }

      // Обновляем базу данных только для новых игр
      if (processedItems.length > 0) {
        const bulkStart = Date.now();
        try {
          await this.gameService.bulkUpsert(processedItems.map(item => item.gameInput));
          const bulkDuration = Date.now() - bulkStart;
          
          // Логируем медленные bulk операции
          if (bulkDuration > 1500) {
            this.logger.warn(`Slow bulk operation: ${bulkDuration}ms for ${processedItems.length} items`);
          }
        } catch (error) {
          this.logger.error('Bulk upsert failed:', error.message);
        }
      }

      const dbOperationsDuration = Date.now() - dbOperationsStart;
      this.trackPerformance('dbQueries', dbOperationsDuration);

      // Отправляем WebSocket сообщения асинхронно
      setImmediate(() => {
        // Отправляем обновления существующих игр
        if (webSocketMessages.length > 0) {
          this.sendWebSocketBatch(webSocketMessages, oddsDataType, 'update_event_full').catch(error => {
            this.logger.error('WebSocket batch update error:', error.message);
          });
        }

        // Отправляем новые игры
        if (processedItems.length > 0) {
          this.sendWebSocketBatch(processedItems, oddsDataType, 'new_event_full').catch(error => {
            this.logger.error('WebSocket batch new events error:', error.message);
          });
        }
      });

      const batchDuration = Date.now() - batchStartTime;
      
      // Отслеживаем производительность батча
      this.trackPerformance('processBatch', batchDuration);
      
      // this.logger.info(
      //   `Batch ${batchIndex + 1}/${totalBatches}: Processed ${batch.length} events (${gameUpdates.length} updates, ${processedItems.length} new) in ${batchDuration}ms`
      // );
    } catch (error) {
      const batchDuration = Date.now() - batchStartTime;
      
      // Отслеживаем производительность даже при ошибке
      this.trackPerformance('processBatch', batchDuration);
      
      this.logger.error(`Error processing batch ${batchIndex + 1}:`, error.message);
      // Не пробрасываем ошибку дальше, чтобы не прерывать обработку других батчей
    }
  }

  // Методы для мониторинга производительности
  private trackPerformance(operation: keyof typeof this.performanceMetrics, duration: number) {
    const metrics = this.performanceMetrics[operation];
    metrics.totalTime += duration;
    metrics.calls++;
    
    // Считаем медленными операции свыше определенных порогов
    const slowThresholds = {
      saveEvents: 3000, // 3 секунды
      processBatch: 2000, // 2 секунды
      dbQueries: 1000, // 1 секунда
      webSocketSends: 500 // 0.5 секунды
    };
    
    if (duration > slowThresholds[operation]) {
      metrics.slowCalls++;
      this.logger.warn(`Slow ${operation} operation: ${duration}ms`);
    }
  }

  private logPerformanceStats() {
    const stats = Object.entries(this.performanceMetrics).map(([operation, metrics]) => {
      const avgTime = metrics.calls > 0 ? Math.round(metrics.totalTime / metrics.calls) : 0;
      const slowPercentage = metrics.calls > 0 ? Math.round((metrics.slowCalls / metrics.calls) * 100) : 0;
      
      return {
        operation,
        avgTime,
        totalCalls: metrics.calls,
        slowCalls: metrics.slowCalls,
        slowPercentage
      };
    });

    this.logger.log('Performance Statistics:', stats);
  }

  // Оптимизированный метод для батчевой отправки WebSocket сообщений
  private async sendWebSocketBatch(items: any[], oddsDataType: string, messageType: string) {
    const startTime = Date.now();
    
    try {
      if (items.length === 0) return;

      // Разбиваем большие батчи на чанки для лучшей производительности
      const CHUNK_SIZE = 50; // Оптимальный размер чанка для WebSocket
      const chunks = [];
      
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        chunks.push(items.slice(i, i + CHUNK_SIZE));
      }

      // Обрабатываем чанки параллельно, но с ограничением
      const MAX_CONCURRENT_CHUNKS = 3;
      const processChunk = async (chunk: any[]) => {
        try {
          // Группируем сообщения по типу подписки
          const batchMessage = {
            type: 'batch_update',
            dataType: oddsDataType,
            messageType,
            events: chunk.map(item => {
               // Оптимизируем создание данных события
               const eventData: any = {
                 eventId: item.eventId,
                 data: {
                   event: item.gameInput || item.data?.event,
                   markets: item.markets || item.data?.markets
                 }
               };

               // Добавляем score только если есть event
               if (item.event) {
                 eventData.data.score = BetApiTransformService.eventToODDSScoreString(item.event);
               }

               return eventData;
             }),
            timestamp: Date.now(),
            chunkSize: chunk.length
          };

          // Отправляем групповое обновление
          const groupMessage = {
            eventId: 'batch',
            type: 'batch_update',
            payload: batchMessage
          };

          // Параллельно отправляем групповое обновление и обновления рынков
          const promises = [];
          
          // Отправляем групповое обновление с обработкой ошибок
          try {
            this.eventGateway.sendGroupUpdate(groupMessage);
          } catch (err) {
            this.logger.warn('Failed to send group update:', err.message);
          }

          // Добавляем обновления рынков батчами для лучшей производительности
           const marketUpdates = chunk
             .filter(item => item.markets && item.markets.length > 0)
             .map(item => {
               try {
                 return this.eventBridge.sendMarketsUpdate(item.eventId, item.markets);
               } catch (err) {
                 this.logger.debug(`Failed to send markets update for ${item.eventId}:`, err.message);
                 return Promise.resolve();
               }
             });

          if (marketUpdates.length > 0) {
            promises.push(...marketUpdates);
          }

          // Добавляем обновления для связанных subgames
          this.logger.debug('Calling sendSubgameUpdates for chunk:', {
            chunkSize: chunk.length,
            eventIds: chunk.map(item => item.eventId).filter(Boolean)
          });
          
          const subgameUpdates = await this.sendSubgameUpdates(chunk);
          
          this.logger.debug('sendSubgameUpdates result:', {
            subgameUpdatesCount: subgameUpdates.length
          });
          
          if (subgameUpdates.length > 0) {
            promises.push(...subgameUpdates);
          }

          await Promise.allSettled(promises);
          
        } catch (error) {
          this.logger.warn(`Failed to process WebSocket chunk of ${chunk.length} items:`, error.message);
          
          // Fallback для чанка: отправляем по одному
           for (const item of chunk) {
             try {
               const combinedData: any = {
                 type: messageType,
                 eventId: item.eventId,
                 data: {
                   event: item.gameInput || item.data?.event,
                   markets: item.markets || item.data?.markets
                 }
               };

               if (item.event) {
                 combinedData.data.score = BetApiTransformService.eventToODDSScoreString(item.event);
               }

               await this.sendWebSocketMessage(combinedData, oddsDataType);
             } catch (fallbackError) {
               this.logger.debug(`Failed to send individual message for event ${item.eventId}:`, fallbackError.message);
             }
           }
        }
      };

      // Обрабатываем чанки с ограничением параллелизма
      for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_CHUNKS) {
        const currentChunks = chunks.slice(i, i + MAX_CONCURRENT_CHUNKS);
        await Promise.allSettled(currentChunks.map(processChunk));
      }

      this.logger.debug(`Sent WebSocket batch with ${items.length} events in ${chunks.length} chunks`);
      
    } catch (error) {
      this.logger.error('WebSocket batch error:', error.message);
      
      // Последний fallback: отправляем все по одному
       for (const item of items) {
         try {
           const combinedData: any = {
             type: messageType,
             eventId: item.eventId,
             data: {
               event: item.gameInput || item.data?.event,
               markets: item.markets || item.data?.markets
             }
           };

           if (item.event) {
             combinedData.data.score = BetApiTransformService.eventToODDSScoreString(item.event);
           }

           await this.sendWebSocketMessage(combinedData, oddsDataType);
         } catch (fallbackError) {
           this.logger.debug(`Failed to send individual message for event ${item.eventId}:`, fallbackError.message);
         }
       }
    } finally {
      // Отслеживаем производительность WebSocket операций
      const duration = Date.now() - startTime;
      this.trackPerformance('webSocketSends', duration);
    }
  }

  // Новый метод для отправки WebSocket сообщений
  private async sendWebSocketMessage(item, oddsDataType, subscriptionType?: 'group' | 'detailed') {
    try {
      // Логируем отправку сообщения для отладки
      this.logger.debug('Sending WebSocket message:', {
        eventId: item.eventId,
        type: item.type,
        dataType: typeof item.data,
        dataKeys: item.data && typeof item.data === 'object' ? Object.keys(item.data) : 'not object',
        subscriptionType
      });

      // Форматируем данные для frontend
      let formattedData = item.data;

      if (item.type === 'update_markets' && Array.isArray(item.data)) {
        // Преобразуем массив массивов в массив объектов с cf
        formattedData = item.data.map(market => {
          if (Array.isArray(market)) {
            return {
              market: market[0],           // название рынка
              cf: market[2],               // коэффициент
              isOpen: !market[1],          // заблокирован ли
              display_name: market[4] || market[0], // отображаемое имя
              oc_group_name: market[5] || 'Unknown', // название группы
              basis: this.extractBasis(market[0]) // извлекаем basis из названия
            };
          }
          return market;
        });

        this.logger.debug('Formatted market data:', {
          eventId: item.eventId,
          originalCount: item.data.length,
          formattedCount: formattedData.length,
          sampleMarket: formattedData[0]
        });

        // Отправляем через EventBridgeService для правильной группировки
        try {
          await this.eventBridge.sendMarketsUpdate(item.eventId, formattedData);
        } catch (error) {
          this.logger.error('Failed to send markets update via EventBridge:', {
            error: error.message || error.toString(),
            stack: error.stack,
            errorType: error.constructor.name,
            eventId: item.eventId,
            dataType: typeof item.data,
            dataLength: Array.isArray(item.data) ? item.data.length : 'not array'
          });
          // Fallback to direct EventGateway с учетом типа подписки
          const message = {
            eventId: item.eventId,
            type: item.type,
            payload: formattedData,
            subscriptionType
          };
          
          if (subscriptionType === 'group') {
            this.eventGateway.sendGroupUpdate(message);
          } else {
            this.eventGateway.sendDetailedUpdate(message);
          }
        }
      } else {
        // Отправляем через EventGateway для фронтенда с учетом типа подписки
        const message = {
          eventId: item.eventId,
          type: item.type,
          payload: formattedData,
          subscriptionType
        };
        
        if (subscriptionType === 'group') {
          this.eventGateway.sendGroupUpdate(message);
        } else {
          this.eventGateway.sendDetailedUpdate(message);
        }
      }

      // Также отправляем через OddsCorpGateway для совместимости
      const wsData = [];
      wsData[MessageIndexes.TYPE] = item.type;
      wsData[MessageIndexes.BK_EVENT_ID] = item.eventId;
      wsData[MessageIndexes.DATA] = item.data; // Используем оригинальные данные для совместимости

      await this.OddsCorpGateway.onMessage(oddsDataType, JSON.stringify(wsData));

      this.logger.debug('WebSocket message sent successfully:', {
        eventId: item.eventId,
        type: item.type
      });
    } catch (error) {
      this.logger.error('WebSocket message failed:', {
        error,
        eventId: item.eventId,
        type: item.type
      });
      throw error;
    }
  }

  /**
   * Извлекает basis из названия рынка
   */
  private extractBasis(marketName: string): string {
    if (!marketName) return 'UNKNOWN';

    // Извлекаем основную часть до первого подчеркивания
    const parts = marketName.split('__');
    if (parts.length > 0) {
      const basis = parts[0];

      // Проверяем, является ли это известным типом ставки
      if (['WIN', 'HANDICAP', 'TOTALS'].includes(basis)) {
        return basis;
      }

      // Если это неизвестный тип, добавляем префикс
      if (!basis.startsWith('UNKNOWN_')) {
        return `UNKNOWN_${basis}`;
      }

      return basis;
    }

    return 'UNKNOWN';
  }

  /**
   * Отправляет обновления для связанных subgames
   */
  private async sendSubgameUpdates(chunk: any[]): Promise<Promise<any>[]> {
    const subgameUpdates: Promise<any>[] = [];
    
    try {
      // Извлекаем eventIds из chunk
      const eventIds = chunk
        .map(item => item.eventId)
        .filter(id => id && typeof id === 'string');

      if (eventIds.length === 0) {
        return subgameUpdates;
      }

      // Находим все subgames связанные с этими событиями
      const relatedSubgames = await this.prismaService.subGame.findMany({
        where: {
          parentEventId: {
            in: eventIds
          }
        },
        select: {
          subEventId: true,
          parentEventId: true,
          updatedAt: true
        }
      });

      if (relatedSubgames.length === 0) {
        return subgameUpdates;
      }

      this.logger.debug('Found related subgames:', {
        parentEventIds: eventIds,
        subgamesCount: relatedSubgames.length,
        subgameEventIds: relatedSubgames.map(sg => sg.subEventId)
      });

      // Для каждого найденного subgame отправляем обновление
      for (const subgame of relatedSubgames) {
        // Находим соответствующий parent item из chunk
        const parentItem = chunk.find(item => item.eventId === subgame.parentEventId);
        
        if (parentItem) {
          this.logger.debug(`[WebSocket] Creating subgame update: parentEventId=${subgame.parentEventId} -> subEventId=${subgame.subEventId}`);
          
          // Создаем обновление для subgame с данными от parent
          const subgameUpdate = {
            eventId: subgame.subEventId,
            type: parentItem.type || 'update_markets',
            data: parentItem.data,
            markets: parentItem.markets,
            gameInput: parentItem.gameInput,
            event: parentItem.event
          };

          this.logger.debug(`[WebSocket] Sending subgame update with eventId=${subgameUpdate.eventId}, type=${subgameUpdate.type}`);

          // Отправляем обновление для subgame
          const updatePromise = this.sendWebSocketMessage(
            subgameUpdate, 
            this.dataType, 
            'detailed'
          ).catch(error => {
            this.logger.warn(`Failed to send subgame update for ${subgame.subEventId}:`, error.message);
          });

          subgameUpdates.push(updatePromise);
        } else {
          this.logger.debug(`[WebSocket] No parent item found for subgame ${subgame.subEventId} with parentEventId=${subgame.parentEventId}`);
        }
      }

      this.logger.debug('Sending subgame updates:', {
        updatesCount: subgameUpdates.length,
        subgameEventIds: relatedSubgames.map(sg => sg.subEventId)
      });

    } catch (error) {
      this.logger.error('Error in sendSubgameUpdates:', {
        error: error.message,
        stack: error.stack
      });
    }

    return subgameUpdates;
  }

  async startUpdateEventsTask(): Promise<void> {
    let isProcessing = false;
    let updateFailureCount = 0;
    let lastSuccessfulUpdateTime = 0;
    let memoryWarningCount = 0;

    const getUpdateInterval = () => {
      if (this.packageExpired) return PACKAGE_EXPIRED_POLL_MS;

      // Увеличиваем базовые интервалы для снижения нагрузки
      const baseInterval = this.dataType === 'live' ? 200 : 1000; // 200мс для live, 1с для line
      let interval = baseInterval;

      if (updateFailureCount > 0) {
        // Линейное увеличение интервала вместо экспоненциального
        interval = Math.min(2000, interval + (updateFailureCount * 100));
      }

      if (this.apiStats.isCircuitOpen) {
        interval = 2000; // Максимум 2 секунды даже при открытом circuit breaker
      }

      return interval;
    };

    const processBatchWithTimeout = async (batch, timeout) => {
      return Promise.race([
        Promise.all(batch.map(item => item.promise())),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Batch timeout')), timeout);
        })
      ]).catch(error => {
        if (error.message === 'Batch timeout') {
          this.logger.warn('Batch processing timeout, continuing with next batch');
          return [];
        }
        throw error;
      });
    };

    const run = async () => {
      if (isProcessing) {
        scheduleNextRun();
        return;
      }

      isProcessing = true;
      const iterationStartTime = Date.now();

      try {
        this.iterationCount++;
        const memoryUsage = process.memoryUsage();
        const heapPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

        // Оптимизация памяти только при критической нагрузке
        if (heapPercentage > 90) {
          this.eventCache = new LRUCache({
            max: 500,
            ttl: CACHE_TTL,
            ttlAutopurge: true,
          });
        }

        // Быстрое обновление с таймаутом
        let updateResult: string[] | undefined;
        try {
          updateResult = await Promise.race([
            this.updateEventsCron(),
            new Promise<string[]>((_, reject) => {
              setTimeout(() => reject(new Error('Update timeout')), 10000); // Увеличиваем таймаут до 10 секунд для стабильности
            })
          ]);
          updateFailureCount = 0;
        } catch (err) {
          this.logger.warn(`Update failed or timed out: ${err.message}`);
          updateFailureCount++;
        }

        // Проверка завершенных игр в фоне
        const timeSinceLastUpdate = Date.now() - lastSuccessfulUpdateTime;
        this.logger.debug(`[DEBUG] Time since last successful update: ${timeSinceLastUpdate}ms`);
        
        if (timeSinceLastUpdate > 2000 && !this.packageExpired) { // Увеличиваем интервал до 2 секунд
          this.logger.info(`[DEBUG] Triggering finaleGames - time since last update: ${timeSinceLastUpdate}ms`);
          setImmediate(async () => {
            try {
              await this.finaleGames();
              lastSuccessfulUpdateTime = Date.now();
            } catch (error) {
              this.logger.error('Background finaleGames error:', error);
            }
          });
        }

        const duration = Date.now() - iterationStartTime;
        if (duration > 5000) { // Увеличиваем порог до 5 секунд для WARN
          this.logger.warn(`Update iteration exceeded 5 seconds: ${duration}ms`);
        } else if (duration > 2000) { // Для 2-5 секунд используем DEBUG
          this.logger.debug(`Update iteration took ${duration}ms`);
        }
      } catch (error) {
        this.logger.error('Update task error:', error);
        updateFailureCount = Math.min(updateFailureCount + 1, 5);
      } finally {
        isProcessing = false;
        scheduleNextRun();
      }
    };

    const scheduleNextRun = () => {
      const interval = getUpdateInterval();
      setTimeout(run, interval);
    };

    // Запускаем первый раз
    run();
  }

  async updateCountries(
    sportId: number = 0,
    dataType: 'line' | 'live' = 'line',
    dataLang: string = this.dataLang,
  ): Promise<void> {
    try {
      const requestURL = `/countries/${sportId}`;
      const response = await this.request<BetApiCountriesResponse>(requestURL, dataType, dataLang);
      this.countries[dataType] = response.body;
      this.logger.debug(
        `Got countries ${dataType}: ${this.countries[dataType].length}`,
        BetApiService.name,
      );
    } catch (error) {
      this.logger.error('Error fetching countries: ' + util.inspect(error), BetApiService.name);
    }
  }

  async updateCountriesCron() {
    this.logger.debug('updateCountriesCron() called', BetApiService.name);
  }

  async updateEvents(
    sportId: number = 0,
    tournamentId: number = 0,
    listType: 'sub',
    pageLength: number = 500,
    dataType: 'line' | 'live' = 'line',
    dataLang: string = this.dataLang,
  ): Promise<string | undefined> {
    try {
      const requestURL = `events/${sportId}/${tournamentId}/${listType}/${pageLength}`;
      const response = await this.request<BetApiEventsResponse>(
        requestURL,
        dataType,
        dataLang,
      );
      const responseDataMap = new Map();

      // // Детальное логирование структуры ответа для отладки
      // this.logger.debug(
      //   `BetAPI response structure for sport ${sportId}: status=${response.status}, bodyType=${typeof response.body}, isArray=${Array.isArray(response.body)}`,
      //   BetApiService.name,
      // );
      
      // Check if response.body is an array or handle object response
      if (!Array.isArray(response.body)) {
        // If response.body is an object, it might be a single tournament or error
        if (response.body && typeof response.body === 'object') {
          // Check if it's a single tournament object
          const bodyObj = response.body as any;
          if (bodyObj.events_list && Array.isArray(bodyObj.events_list)) {
            // Convert single tournament to array format
            this.logger.debug(
              `Converting single tournament object to array format for sport ${sportId}`,
              BetApiService.name,
            );
            response.body = [bodyObj];
          } else if (bodyObj.events_list && !Array.isArray(bodyObj.events_list)) {
            // Handle case where events_list is not an array
            this.logger.debug(
              `Single tournament with non-array events_list for sport ${sportId}, skipping`,
              BetApiService.name,
            );
            return `${dataType}_${sportId}: no events`;
          } else if (Object.keys(bodyObj).length === 0) {
            // Handle empty object response (API doesn't exist for this sport) - only log once per hour
            const logKey = `empty_sport_${sportId}_${dataType}`;
            const lastLogTime = this.eventLastFetch[logKey] || 0;
            const now = Date.now();
            if (now - lastLogTime > 3600000) { // 1 hour
              this.logger.warn(
                `No data available for sport ${sportId} - API endpoint may not exist for this sport`,
                BetApiService.name,
              );
              this.eventLastFetch[logKey] = now;
            }
            return `${dataType}_${sportId}: no events`;
          } else {
            // Log detailed error information only for truly unexpected responses
            this.logger.warn(
              `Non-array response body for sport ${sportId}: ${JSON.stringify(response.body).substring(0, 500)}`,
              BetApiService.name,
            );
            this.logger.error(
              `Invalid response body format for sport ${sportId}. Expected array or tournament object with events_list. Got object with keys: ${Object.keys(bodyObj).join(', ')}. Body sample: ${JSON.stringify(bodyObj).substring(0, 200)}`,
              BetApiService.name,
            );
            return `${dataType}_${sportId}: invalid response format`;
          }
        } else {
          // Log detailed error information
          this.logger.error(
            `Invalid response body format for sport ${sportId}. Expected array, got ${typeof response.body}. Value: ${JSON.stringify(response.body)}`,
            BetApiService.name,
          );
          return `${dataType}_${sportId}: invalid response format`;
        }
      }

      response.body.forEach((tournament) => {
        if (!Array.isArray(tournament.events_list)) {
          this.logger.debug(
            `Invalid tournament events_list format for tournament: ${tournament.tournament_id}`,
            BetApiService.name,
          );
          return;
        }

        tournament.events_list.forEach((event) => {
          if (event.game_id != event.game_mid) {
            this.logger.debug('Found sub_game', event);
          } else {
            responseDataMap.set(event.game_id, event);
          }
        });
      });

      const eventsKey = dataType + '_' + sportId;
      const promisesRemoveEvents = [];

      if (
        undefined !== this.events[eventsKey] &&
        this.events[eventsKey].size > 0
      ) {
        const was = Array.from(this.events[eventsKey].keys()).map((_) =>
          Number(_),
        );
        const now = Array.from(responseDataMap.keys()).map((_) => Number(_));
        const difference = was.filter((_) => !now.includes(_));

        if (dataType == 'live') {
          // Добавляем задержку 2 минуты перед удалением игр
          const REMOVE_DELAY_MS = 2 * 60 * 1000; // 2 минуты
          const currentTime = Date.now();
          
          // Инициализируем карту времени последнего появления если её нет
          if (!this.gameLastSeenMap) {
            this.gameLastSeenMap = new Map();
          }
          
          difference.map((eventId) => {
            const lastSeen = this.gameLastSeenMap.get(eventId) || currentTime;
            
            // Удаляем игру только если она отсутствует более 2 минут
            if (currentTime - lastSeen > REMOVE_DELAY_MS) {
              const wsData = [];
              wsData[MessageIndexes.TYPE] = 'remove_event';
              wsData[MessageIndexes.BK_EVENT_ID] = String(eventId);
              wsData[MessageIndexes.DATA] = { received_from_parsers: true };
              const d = responseDataMap.get(eventId);

              this.logger.debug('Send remove_event after delay: ', { eventId, lastSeen: new Date(lastSeen), delay: currentTime - lastSeen });
              promisesRemoveEvents.push(
                this.OddsCorpGateway.onMessage('live', JSON.stringify(wsData)),
              );
              
              // Удаляем из карты времени
              this.gameLastSeenMap.delete(eventId);
            } else {
              this.logger.debug('Game temporarily missing, not removing yet: ', { eventId, timeSinceLastSeen: currentTime - lastSeen });
            }
          });
        }
      }

      // Обновляем время последнего появления для всех текущих игр
      if (dataType === 'live') {
        const currentTime = Date.now();
        responseDataMap.forEach((_, eventId) => {
          this.gameLastSeenMap.set(eventId, currentTime);
        });
      }

      this.events[eventsKey] = responseDataMap;
      await this.saveEvents(eventsKey, dataType).then(async () => {
        await Promise.all(promisesRemoveEvents).catch((errors) =>
          this.logger.error('promisesRemoveEvents errors', errors),
        );
      });
      this.prevEvents[eventsKey] = this.events[eventsKey];
      return eventsKey + ': ' + this.events[eventsKey].size;
    } catch (error) {
      this.logger.error(
        'Error fetching events: ' + util.inspect(error),
        BetApiService.name,
      );
      return `${dataType}_${sportId}: error`;
    }
  }

  async updateEventsCron() {
    const enabled = this.configService.get('BETAPI_ENABLED');
    if (enabled !== 'true' && enabled !== true) return [];
    if (this.packageExpired) return [];

    const iterationStartTime = Date.now();
    const results = [];

    try {
        const sportIds = (this.configService.get<string>('BETAPI_SPORTS_IDS') || '1')
          .split(',')
          .filter((id) => id.trim())
          .map((id) => Number(id.trim()));

        const validSportIds = sportIds.filter((id) => id > 0);

        // Получаем статистику игр по статусам для определения приоритетов
        const gameStats = await this.prismaService.game.groupBy({
          by: ['status'],
          _count: {
            status: true
          },
          where: {
            sport: {
              in: validSportIds.map(id => id.toString())
            }
          }
        });

        const liveGamesCount = gameStats.find(stat => stat.status === 'IN_PROGRESS')?._count?.status || 0;
        const prematchGamesCount = gameStats.find(stat => stat.status === 'PREMATCH')?._count?.status || 0;
        const finishedGamesCount = gameStats.find(stat => stat.status === 'FINISHED')?._count?.status || 0;

        this.logger.debug(`Game stats: LIVE=${liveGamesCount}, PREMATCH=${prematchGamesCount}, FINISHED=${finishedGamesCount}`);

        // Обрабатываем только LIVE события для снижения нагрузки
        // LINE события обрабатываем реже, но чаще если много PREMATCH игр
        const shouldProcessLine = this.iterationCount % 2 === 0 || prematchGamesCount > liveGamesCount * 1.5; // LINE каждые 2 итерации или если много PREMATCH игр
        
        this.logger.debug(`Iteration ${this.iterationCount}: shouldProcessLine=${shouldProcessLine} (iterationCount % 2 = ${this.iterationCount % 2}, prematchGamesCount > liveGamesCount * 1.5 = ${prematchGamesCount > liveGamesCount * 1.5})`);

        // LIVE события обрабатываем последовательно с увеличенными таймаутами
        // Ограничиваем количество одновременно обрабатываемых спортов
        const LIVE_BATCH_SIZE = 3; // Обрабатываем по 3 спорта одновременно
        for (let i = 0; i < validSportIds.length; i += LIVE_BATCH_SIZE) {
          const sportBatch = validSportIds.slice(i, i + LIVE_BATCH_SIZE);
          
          // Обрабатываем батч спортов параллельно
          const batchPromises = sportBatch.map(async (sportId) => {
            try {
              const result = await Promise.race([
                this.updateEvents(sportId, 0, 'sub', 100, 'live'), // Уменьшаем размер страницы еще больше
                new Promise(resolve => setTimeout(() => resolve(`live_${sportId}: timeout`), 6000)) // Уменьшаем таймаут до 6 секунд
              ]);
              return result;
            } catch (error) {
              this.logger.error(`Error updating live events for sport ${sportId}:`, error);
              return `live_${sportId}: error`;
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // Пауза между батчами спортов
          if (i + LIVE_BATCH_SIZE < validSportIds.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // LINE события обрабатываем только периодически и с большими паузами
        if (shouldProcessLine) {
          const LINE_BATCH_SIZE = 1; // Обрабатываем по одному спорту для максимальной стабильности
          for (let i = 0; i < validSportIds.length; i += LINE_BATCH_SIZE) {
            const sportBatch = validSportIds.slice(i, i + LINE_BATCH_SIZE);

            // Обрабатываем LINE события последовательно, а не параллельно
            for (const sportId of sportBatch) {
              try {
                const result = await Promise.race([
                  this.updateEvents(sportId, 0, 'sub', 50, 'line'), // Значительно уменьшаем размер страницы
                  new Promise(resolve => setTimeout(() => resolve(`line_${sportId}: timeout`), 5000)) // Уменьшаем таймаут до 5 секунд
                ]);
                results.push(result);

                // Большая пауза между LINE событиями
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (error) {
                this.logger.error(`Error updating line events for sport ${sportId}:`, error);
                results.push(`line_${sportId}: error`);
              }
            }

            // Увеличиваем паузу между батчами LINE событий
            if (i + LINE_BATCH_SIZE < validSportIds.length) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Уменьшаем паузу до 1 секунды
            }
          }
        }

        const iterationDuration = Date.now() - iterationStartTime;
        this.logger.debug(
          `Update iteration completed in ${iterationDuration}ms`,
          { 
            live: results.filter(r => typeof r === 'string' && r.includes('live')).length, 
            line: results.filter(r => typeof r === 'string' && r.includes('line')).length,
            processedLine: shouldProcessLine,
            gameStats: { liveGamesCount, prematchGamesCount, finishedGamesCount }
          }
        );

        return results;
      } catch (error) {
        this.logger.error('Update iteration failed:', error);
        throw error;
      }
  }

  private markPackageExpired(): void {
    this.packageExpired = true;
    this.apiStats.isCircuitOpen = true;
    this.apiStats.circuitOpenTime = Date.now();
    if (!this.packageExpiredLogged) {
      this.packageExpiredLogged = true;
      this.logger.error(
        'BetAPI package expired (status 99) — polling paused until package renewal or restart',
        BetApiService.name,
      );
    }
  }

  async updateSports(
    dataType: 'line' | 'live' = 'line',
    dataLang: string = this.dataLang,
  ): Promise<void> {
    try {
      const requestURL = `/sports`;
      const response = await this.request<BetApiSportsResponse>(requestURL, dataType, dataLang);
      this.sports[dataType] = response.body;
      this.logger.debug(
        `Got sports ${dataType}: ${this.sports[dataType].length}`,
        BetApiService.name,
      );
    } catch (error) {
      this.logger.error('Error fetching sports: ' + util.inspect(error), BetApiService.name);
    }
  }

  async updateSportsCron() {
    this.logger.debug('updateSportsCron() called', BetApiService.name);
  }

  async updateTournaments(
    sportId: number = 0,
    countryId: number = 0,
    dataType: 'line' | 'live' = 'line',
    dataLang: string = this.dataLang,
  ): Promise<void> {
    try {
      const requestURL = `/tournaments/${sportId}/${countryId}`;
      const response = await this.request<BetApiTournamentResponse>(requestURL, dataType, dataLang);
      this.tournaments[dataType] = response.body;
      this.logger.debug(
        `Got tournaments ${dataType}: ${this.tournaments[dataType].length}`,
        BetApiService.name,
      );
    } catch (error) {
      this.logger.error('Error fetching tournaments: ' + util.inspect(error), BetApiService.name);
    }
  }

  /**
   * Обработка subgame события
   */
  private async processSubGame(event: GameBetApi, dataType: 'line' | 'live'): Promise<void> {
    try {
      const parentEventId = event.game_mid.toString();
      const subEventId = event.game_id.toString();
      
      this.logger.debug(`Processing subgame ${subEventId} with parent ${parentEventId}`);
      
      // Проверяем, существует ли родительская игра
      const parentGame = await this.prismaService.game.findUnique({
        where: { eventId: parentEventId }
      });
      
      if (!parentGame) {
        this.logger.warn(`Parent game ${parentEventId} not found for subgame ${subEventId}`);
        return;
      }
      
      // Подготавливаем данные subgame
      const subGameData = {
        parentEventId: parentEventId,
        subEventId: subEventId,
        gameId: parseInt(subEventId),
        gameNum: event.game_num || 1,
        gameName: event.eventName || `Sub-game ${subEventId}`,
        gameStart: event.game_start || null,
        status: event.status?.toString() || 'active',
        score: event.score_full || '',
        
        // Наследуем данные от родительской игры
        eventName: parentGame.eventName,
        leagueName: parentGame.leagueName,
        sport: parentGame.sport,
        team1: parentGame.team1,
        team2: parentGame.team2,
        startTime: parentGame.createdAt,
        priority: parentGame.priority,
        
        // Сохраняем рынки и метаданные
        markets: event.game_oc_list ? BetApiTransformService.PrepareOsList(event) : null,
        meta: {
          originalEvent: event,
          parentGameData: {
            eventId: parentGame.eventId,
            eventName: parentGame.eventName,
            leagueName: parentGame.leagueName,
            sport: parentGame.sport,
            team1: parentGame.team1,
            team2: parentGame.team2,
            priority: parentGame.priority
          },
          processedAt: new Date().toISOString(),
          dataType: dataType
        }
      };
      
      // Используем upsert для создания или обновления subgame
      await this.prismaService.subGame.upsert({
        where: { subEventId: subEventId },
        update: subGameData,
        create: subGameData
      });
      
      this.logger.debug(`Subgame ${subEventId} processed and saved with parent ${parentEventId}`);
      
    } catch (error) {
      this.logger.error(`Error processing subgame ${event.game_id}:`, error);
    }
  }

}
