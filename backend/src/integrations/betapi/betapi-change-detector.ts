import { Injectable, Logger, Inject } from '@nestjs/common';
import { GameBetApi, GameBetApiType } from '@prisma/client';
import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { LRUCache } from 'lru-cache';
import { BetApiWebSocketEvent, BetApiPerformanceStats, BetApiWebSocketStatus } from './types/betapi-websocket-event';
import { EventEmitter } from 'events';
import { EventGateway } from '~/main/event/event.gateway';
import { EventBridgeService } from '~/main/event/event-bridge.service';

// Константы для оптимизации производительности
const BATCH_PAUSE = 50; // Увеличиваем паузу между батчами
const MAX_CONCURRENT_REQUESTS = 10; // Уменьшаем количество параллельных запросов
const UPDATE_INTERVAL_BASE = 200; // Увеличиваем базовый интервал
const UPDATE_FAILURE_MAX_INTERVAL = 2000; // Увеличиваем максимальный интервал при ошибках
const MAX_CONSECUTIVE_ERRORS = 100; // Уменьшаем для более быстрой реакции

// Типы данных
export interface BetApiEvent {
  id: string;
  type: 'LIVE' | 'PREMATCH';
  startTime?: string;
  data: any;
}

export interface ChangeDetectionConfig {
  minInterval: number;
  maxInterval: number;
  adaptiveInterval: boolean;
  changeThreshold: number;
  bufferSize: number;
  bufferTTL: number;
}

@Injectable()
export class BetApiChangeDetector extends EventEmitter {
  private readonly logger = new Logger(BetApiChangeDetector.name);
  private readonly eventData = {
    [GameBetApiType.LIVE]: new Map<string, any>(),
    [GameBetApiType.LINE]: new Map<string, any>()
  };
  private readonly eventQueue = {
    [GameBetApiType.LIVE]: new Set<string>(),
    [GameBetApiType.LINE]: new Set<string>()
  };
  private readonly priorityEvents = {
    [GameBetApiType.LIVE]: new Set<string>(),
    [GameBetApiType.LINE]: new Set<string>()
  };
  private readonly stats = {
    [GameBetApiType.LIVE]: {
      errorCount: 0,
      updateTimes: [] as number[],
      currentInterval: 1000,
      priorityEventsCount: 0
    },
    [GameBetApiType.LINE]: {
      errorCount: 0,
      updateTimes: [] as number[],
      currentInterval: 2000,
      priorityEventsCount: 0
    }
  };
  private previousData: Map<string, GameBetApi> = new Map();
  private changeCount: Map<string, number> = new Map();
  private lastCheckTime: Map<string, number> = new Map();
  private currentInterval: number;
  private readonly config: ChangeDetectionConfig;
  private eventBuffer: LRUCache<string, BetApiWebSocketEvent>;
  private lastProcessingTimes: number[] = [];
  private readonly eventUpdateTimes = new Map<string, number>();
  private readonly eventErrorCounts = new Map<string, number>();
  private consecutiveErrors = 0;
  private lastBatchTime = 0;

  constructor(
    private readonly wsAdapter: BetApiWebSocketAdapter,
    private readonly eventGateway: EventGateway,
    private readonly eventBridge: EventBridgeService,
    @Inject('CHANGE_DETECTION_CONFIG') config?: ChangeDetectionConfig
  ) {
    super();
    this.config = config || {
      minInterval: 50,     // Уменьшаем до 50мс для быстрых обновлений
      maxInterval: 1000,   // Максимум 1 сек
      adaptiveInterval: true,
      changeThreshold: 1,  // Быстрее реагируем на изменения
      bufferSize: 500,     // Увеличиваем размер буфера
      bufferTTL: 60000     // TTL 1 минута
    };

    this.currentInterval = this.config.minInterval;
    this.eventBuffer = new LRUCache({
      max: this.config.bufferSize,
      ttl: this.config.bufferTTL,
      updateAgeOnGet: true
    });

    // Запускаем мониторинг производительности
    setInterval(() => this.monitorPerformance(), 10000);
    this.setMaxListeners(20);
  }

  onEvent(event: BetApiWebSocketEvent): void {
    const dataType = this.convertDataType(event.dataType || GameBetApiType.LIVE);
    const startTime = Date.now();

    try {
      const eventData = this.eventData[dataType];
      const priorityEvents = this.priorityEvents[dataType];
      let stats = this.stats[dataType];

      if (!stats) {
        stats = this.stats[dataType] = {
          errorCount: 0,
          updateTimes: [],
          currentInterval: this.getDefaultInterval(dataType),
          priorityEventsCount: 0
        };
      }

      const oldData = eventData.get(event.eventId);
      eventData.set(event.eventId, event.data);

      if (this.hasChanges(oldData, event.data)) {
        const isPriority = priorityEvents.has(event.eventId);
        this.emit('change', {
          id: event.id,
          eventId: event.eventId,
          type: event.type,
          data: event.data,
          timestamp: Date.now(),
          priority: isPriority ? 1 : 0,
          dataType
        });

        const processingTime = Date.now() - startTime;
        stats.updateTimes.push(processingTime);
        if (stats.updateTimes.length > 100) {
          stats.updateTimes.shift();
        }

        this.adjustInterval(dataType);
      }
    } catch (error) {
      this.logger.error(`Error processing ${dataType} event:`, error);
      if (this.stats[dataType]) {
        this.stats[dataType].errorCount++;
      }
    }
  }

  private convertDataType(type: GameBetApiType | 'live' | 'line' | undefined): GameBetApiType {
    if (type === undefined) {
      return GameBetApiType.LIVE;
    }
    if (type === 'line' || type === GameBetApiType.LINE) {
      return GameBetApiType.LINE;
    }
    return GameBetApiType.LIVE;
  }

  private getDefaultInterval(type: GameBetApiType): number {
    return type === GameBetApiType.LIVE ? 100 : 200;
  }

  private adjustInterval(dataType: GameBetApiType | 'live' | 'line'): void {
    const type = this.convertDataType(dataType);
    const stats = this.stats[type];
    const avgTime = this.calculateAverageTime(stats.updateTimes);
    
    if (avgTime > stats.currentInterval * 0.8) {
      stats.currentInterval = Math.min(stats.currentInterval * 1.2, 1000);
    } else if (avgTime < stats.currentInterval * 0.5) {
      stats.currentInterval = Math.max(stats.currentInterval * 0.8, 50);
    }
  }

  private calculateAverageTime(times: number[]): number {
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  private hasChanges(oldData: any, newData: any): boolean {
    if (!oldData) return true;
    return JSON.stringify(oldData) !== JSON.stringify(newData);
  }

  setPriority(eventId: string, isPriority: boolean, dataType: GameBetApiType = GameBetApiType.LIVE): void {
    const type = this.convertDataType(dataType);
    const priorityEvents = this.priorityEvents[type];
    if (isPriority) {
      priorityEvents.add(eventId);
      this.stats[type].priorityEventsCount++;
    } else {
      priorityEvents.delete(eventId);
      this.stats[type].priorityEventsCount = Math.max(0, this.stats[type].priorityEventsCount - 1);
    }
  }

  clearEventData(eventId: string, dataType: GameBetApiType = GameBetApiType.LIVE): void {
    const type = this.convertDataType(dataType);
    this.eventData[type].delete(eventId);
    this.priorityEvents[type].delete(eventId);
    if (this.priorityEvents[type].has(eventId)) {
      this.stats[type].priorityEventsCount = Math.max(0, this.stats[type].priorityEventsCount - 1);
    }
  }

  getPerformanceStats(dataType?: GameBetApiType): BetApiWebSocketStatus {
    if (dataType) {
      const type = this.convertDataType(dataType);
      const stats = this.stats[type];
      return {
        connected: true,
        bufferSize: this.eventData[dataType].size,
        queueSize: this.eventQueue[dataType].size,
        lastEventTime: Date.now(),
        reconnectAttempts: 0,
        currentInterval: stats.currentInterval,
        priorityEventsCount: stats.priorityEventsCount,
        errorCount: stats.errorCount,
        averageUpdateTime: this.calculateAverageTime(stats.updateTimes),
        processingTimes: {
          average: this.calculateAverageTime(stats.updateTimes),
          max: Math.max(...stats.updateTimes, 0)
        },
        dataType
      };
    }

    return {
      connected: true,
      bufferSize: this.eventData[GameBetApiType.LIVE].size + this.eventData[GameBetApiType.LINE].size,
      queueSize: this.eventQueue[GameBetApiType.LIVE].size + this.eventQueue[GameBetApiType.LINE].size,
      lastEventTime: Date.now(),
      reconnectAttempts: 0,
      currentInterval: Math.max(this.stats[GameBetApiType.LIVE].currentInterval, this.stats[GameBetApiType.LINE].currentInterval),
      priorityEventsCount: this.stats[GameBetApiType.LIVE].priorityEventsCount + this.stats[GameBetApiType.LINE].priorityEventsCount,
      errorCount: this.stats[GameBetApiType.LIVE].errorCount + this.stats[GameBetApiType.LINE].errorCount,
      averageUpdateTime: this.calculateAverageTime([...this.stats[GameBetApiType.LIVE].updateTimes, ...this.stats[GameBetApiType.LINE].updateTimes]),
      processingTimes: {
        average: this.calculateAverageTime([...this.stats[GameBetApiType.LIVE].updateTimes, ...this.stats[GameBetApiType.LINE].updateTimes]),
        max: Math.max(
          Math.max(...this.stats[GameBetApiType.LIVE].updateTimes, 0),
          Math.max(...this.stats[GameBetApiType.LINE].updateTimes, 0)
        )
      },
      dataType: GameBetApiType.LIVE
    };
  }

  reset(dataType?: GameBetApiType): void {
    if (dataType) {
      const type = this.convertDataType(dataType);
      this.eventData[type].clear();
      this.priorityEvents[type].clear();
      this.stats[type] = {
        errorCount: 0,
        updateTimes: [],
        currentInterval: this.getDefaultInterval(dataType),
        priorityEventsCount: 0
      };
    } else {
      this.eventData[GameBetApiType.LIVE].clear();
      this.eventData[GameBetApiType.LINE].clear();
      this.priorityEvents[GameBetApiType.LIVE].clear();
      this.priorityEvents[GameBetApiType.LINE].clear();
      this.stats[GameBetApiType.LIVE] = {
        errorCount: 0,
        updateTimes: [],
        currentInterval: 1000,
        priorityEventsCount: 0
      };
      this.stats[GameBetApiType.LINE] = {
        errorCount: 0,
        updateTimes: [],
        currentInterval: 2000,
        priorityEventsCount: 0
      };
    }
  }

  public async detectChanges(
    eventId: string,
    currentData: GameBetApi,
    dataType: GameBetApiType,
    subscriptionType: 'group' | 'detail' = 'group'
  ): Promise<boolean> {
    const startTime = Date.now();
    const previousData = this.eventData[dataType].get(eventId);
    const now = Date.now();
    const lastCheck = this.lastCheckTime.get(eventId) || 0;
    const isPriority = this.priorityEvents[dataType].has(eventId);

    // Для приоритетных событий используем минимальный интервал
    const checkInterval = isPriority ? 
      this.config.minInterval : 
      this.currentInterval;

    if (now - lastCheck < checkInterval) {
      return false;
    }

    this.lastCheckTime.set(eventId, now);

    if (!previousData) {
      this.eventData[dataType].set(eventId, currentData);
      this.emitInitialEvent(eventId, currentData, dataType);
      this.trackProcessingTime(startTime);
      return true;
    }

    const changes = this.compareData(previousData, currentData);
    
    if (changes.length > 0) {
      this.logger.debug(`Changes detected for event ${eventId}:`, changes);
      
      this.eventData[dataType].set(eventId, currentData);
      const changeCount = (this.changeCount.get(eventId) || 0) + 1;
      this.changeCount.set(eventId, changeCount);
      
      await this.emitChangeEvents(eventId, currentData, changes, dataType, subscriptionType);
      
      if (this.config.adaptiveInterval) {
        this.adjustInterval(dataType);
      }

      // Проверяем и компенсируем задержки
      this.compensateDelay(startTime, changes);
      
      this.trackProcessingTime(startTime);
      return true;
    }

    const changeCount = Math.max(0, (this.changeCount.get(eventId) || 0) - 1);
    this.changeCount.set(eventId, changeCount);
    
    this.trackProcessingTime(startTime);
    return false;
  }

  private compareData(previous: GameBetApi, current: GameBetApi): string[] {
    const changes: string[] = [];
    const fieldsToMonitor = [
      'score_full',
      'score_period',
      'score_extra',
      'timer',
      'status',
      'finale',
      'game_oc_list',
      'priority'
    ];

    for (const field of fieldsToMonitor) {
      if (field === 'game_oc_list') {
        // Специальная обработка для коэффициентов
        const prevOdds = this.extractOdds(previous[field]);
        const currOdds = this.extractOdds(current[field]);
        
        // Логируем для отладки коэффициентов
        this.logger.debug('Comparing odds:', {
          eventId: current.game_id,
          prevOddsCount: prevOdds.size,
          currOddsCount: currOdds.size,
          prevOddsSample: Array.from(prevOdds.entries()).slice(0, 3),
          currOddsSample: Array.from(currOdds.entries()).slice(0, 3)
        });
        
        if (this.oddsChanged(prevOdds, currOdds)) {
          this.logger.debug('Odds changed detected:', {
            eventId: current.game_id,
            prevOddsCount: prevOdds.size,
            currOddsCount: currOdds.size
          });
          changes.push(field);
        }
        continue;
      }

      const prevValue = previous[field as keyof GameBetApi];
      const currValue = current[field as keyof GameBetApi];
      
      if (prevValue !== currValue) {
        changes.push(field);
      }
    }

    // Логируем все изменения
    if (changes.length > 0) {
      this.logger.debug('Changes detected:', {
        eventId: current.game_id,
        changes,
        fieldsChanged: changes.length
      });
    }

    return changes;
  }

  private extractOdds(ocList: any): Map<string, number> {
    const odds = new Map<string, number>();
    if (Array.isArray(ocList)) {
      ocList.forEach(oc => {
        if (oc.oc_rate) {
          odds.set(oc.oc_name, oc.oc_rate);
        }
      });
    }
    return odds;
  }

  private oddsChanged(prev: Map<string, number>, curr: Map<string, number>): boolean {
    if (prev.size !== curr.size) return true;
    
    for (const [key, value] of prev) {
      if (!curr.has(key) || Math.abs(curr.get(key)! - value) > 0.01) {
        return true;
      }
    }
    return false;
  }

  private async emitChangeEvents(
    eventId: string,
    data: GameBetApi,
    changes: string[],
    dataType: GameBetApiType,
    subscriptionType: 'group' | 'detail' = 'group'
  ): Promise<void> {
    const now = Date.now();
    const isPriority = this.priorityEvents[dataType].has(eventId);

    // Основное событие обновления
    const eventUpdate: BetApiWebSocketEvent = {
      id: eventId,
      eventId: eventId,
      type: 'event_update',
      data: {
        type: 'update',
        gameData: data,
        changes,
        dataType,
        isPriority,
        subscriptionType
      },
      timestamp: now,
      dataType,
      subscriptionType
    };
    this.wsAdapter.send(eventUpdate);
    this.eventBuffer.set(`${eventId}:update`, eventUpdate);

    // Отправляем через EventGateway для фронтенда
    this.eventGateway.sendUpdate({
      eventId: eventId,
      type: 'update_event',
      payload: {
        gameData: data,
        changes,
        dataType,
        isPriority
      }
    });

    // Специфичные события
    if (changes.includes('score_full') || changes.includes('score_period')) {
      const scoreEvent: BetApiWebSocketEvent = {
        id: eventId,
        eventId: eventId,
        type: 'score_update',
        data: {
          score_full: data.score_full,
          score_period: data.score_period,
          score_extra: data.score_extra,
          timer: data.timer,
          isPriority,
          subscriptionType
        },
        timestamp: now,
        dataType,
        subscriptionType
      };
      this.wsAdapter.send(scoreEvent);
      this.eventBuffer.set(`${eventId}:score`, scoreEvent);

      // Отправляем обновление счета через EventGateway
      this.eventGateway.sendUpdate({
        eventId: eventId,
        type: 'updateParsedScore',
        payload: {
          score_full: data.score_full,
          score_period: data.score_period,
          score_extra: data.score_extra,
          timer: data.timer
        }
      });
    }

    if (changes.includes('game_oc_list')) {
      this.logger.debug('Emitting market update event:', {
        eventId: eventId,
        dataType,
        isPriority,
        oddsCount: Array.isArray(data.game_oc_list) ? data.game_oc_list.length : 0
      });

      const marketEvent: BetApiWebSocketEvent = {
        id: eventId,
        eventId: eventId,
        type: 'market_update',
        data: {
          game_oc_list: data.game_oc_list,
          game_oc_counter: data.game_oc_counter,
          isPriority,
          subscriptionType
        },
        timestamp: now,
        dataType,
        subscriptionType
      };
      this.wsAdapter.send(marketEvent);
      this.eventBuffer.set(`${eventId}:market`, marketEvent);

      // Форматируем данные для frontend
      let formattedMarkets = data.game_oc_list;
      if (Array.isArray(data.game_oc_list)) {
        formattedMarkets = data.game_oc_list.map(market => {
          if (Array.isArray(market)) {
            const marketName = typeof market[0] === 'string' ? market[0] : String(market[0]);
            return {
              market: marketName,              // название рынка
              cf: Number(market[2]),          // коэффициент
              isOpen: !Boolean(market[1]),    // заблокирован ли
              display_name: String(market[4] || market[0]), // отображаемое имя
              oc_group_name: String(market[5] || 'Unknown'), // название группы
              basis: this.extractBasis(marketName) // извлекаем basis из названия
            };
          }
          return market;
        });
      }

      // Отправляем обновление маркетов через EventBridgeService для правильной группировки
      try {
        if (Array.isArray(formattedMarkets)) {
          await this.eventBridge.sendMarketsUpdate(eventId, formattedMarkets);
        } else {
          this.logger.warn('Formatted markets is not an array, using fallback');
          this.eventGateway.sendUpdate({
            eventId: eventId,
            type: 'update_markets',
            payload: formattedMarkets
          });
        }
      } catch (error) {
        this.logger.error('Failed to send markets update via EventBridge:', error);
        // Fallback to direct EventGateway
        this.eventGateway.sendUpdate({
          eventId: eventId,
          type: 'update_markets',
          payload: formattedMarkets
        });
      }

      this.logger.debug('Market update event sent successfully:', {
        eventId: eventId,
        type: 'update_markets',
        marketsCount: Array.isArray(formattedMarkets) ? formattedMarkets.length : 0,
        sampleMarket: Array.isArray(formattedMarkets) ? formattedMarkets[0] : null
      });
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
      const knownBasisTypes = [
        'WIN',
        'HANDICAP', 
        'TOTALS',
        'INDIVIDUAL_TOTAL',
        'BOTH_TEAMS_SCORE',
        'CORRECT_SCORE',
        'FIRST_GOAL',
        'HT_FT',
        'CLEAN_SHEET',
        'CORNERS_TOTAL',
        'CORNERS_HANDICAP',
        'CARDS_TOTAL'
      ];
      
      if (knownBasisTypes.includes(basis)) {
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

  private compensateDelay(startTime: number, changes: string[]): void {
    const delay = Date.now() - startTime;
    
    // Если задержка больше 1 секунды или есть важные изменения
    if (delay > 1000 || changes.includes('game_oc_list')) {
      this.currentInterval = Math.max(
        this.config.minInterval,
        this.currentInterval * 0.5
      );
      this.logger.warn(
        `High delay detected (${delay}ms), reducing interval to ${this.currentInterval}ms`
      );
    }
  }

  private trackProcessingTime(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.lastProcessingTimes.push(processingTime);
    
    // Храним только последние 100 замеров
    if (this.lastProcessingTimes.length > 100) {
      this.lastProcessingTimes.shift();
    }
  }

  private monitorPerformance(): void {
    if (this.lastProcessingTimes.length === 0) return;

    const avgProcessingTime = this.lastProcessingTimes.reduce((a, b) => a + b, 0) / 
      this.lastProcessingTimes.length;
    const maxProcessingTime = Math.max(...this.lastProcessingTimes);

    this.logger.debug(`Performance metrics:
      Average processing time: ${avgProcessingTime.toFixed(2)}ms
      Max processing time: ${maxProcessingTime}ms
      Current interval: ${this.currentInterval}ms
      Priority events: ${this.priorityEvents[GameBetApiType.LIVE].size}
      Buffer size: ${this.eventBuffer.size}
    `);

    // Сброс метрик
    this.lastProcessingTimes = [];
  }

  public getCurrentInterval(): number {
    return this.currentInterval;
  }

  public getChangeStats(): { eventId: string; changeCount: number }[] {
    return Array.from(this.changeCount.entries()).map(([eventId, count]) => ({
      eventId,
      changeCount: count
    }));
  }

  // Оптимизированные методы обработки событий
  async processEvents(events: BetApiEvent[]): Promise<void> {
    const now = Date.now();
    const batchDelay = now - this.lastBatchTime;
    
    if (batchDelay < BATCH_PAUSE) {
      await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE - batchDelay));
    }
    
    this.lastBatchTime = now;
    
    // Сортируем события по приоритету
    const sortedEvents = this.sortEventsByPriority(events);
    
    // Обрабатываем события параллельно с ограничением
    const chunks = this.chunkArray(sortedEvents, MAX_CONCURRENT_REQUESTS);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async event => {
          try {
            await this.processEvent(event.id, event.type === 'LIVE' ? GameBetApiType.LIVE : GameBetApiType.LINE);
            this.updateEventStats(event.id, true);
          } catch (error) {
            this.updateEventStats(event.id, false);
            throw error;
          }
        })
      );
    }
  }

  private sortEventsByPriority(events: BetApiEvent[]): BetApiEvent[] {
    return events.sort((a, b) => {
      // Приоритизация по типу события
      const aPriority = this.getEventPriority(a);
      const bPriority = this.getEventPriority(b);
      if (aPriority !== bPriority) return bPriority - aPriority;

      // Приоритизация по времени последнего обновления
      const aLastUpdate = this.eventUpdateTimes.get(a.id) || 0;
      const bLastUpdate = this.eventUpdateTimes.get(b.id) || 0;
      return aLastUpdate - bLastUpdate;
    });
  }

  private getEventPriority(event: BetApiEvent): number {
    if (this.priorityEvents[event.type === 'LIVE' ? GameBetApiType.LIVE : GameBetApiType.LINE].has(event.id)) return 10;
    if (event.type === 'LIVE' && event.startTime && 
        Date.now() - new Date(event.startTime).getTime() < 3600000) return 8;
    if (event.type === 'PREMATCH' && event.startTime && 
        Date.now() - new Date(event.startTime).getTime() < 3600000) return 6;
    return 4;
  }

  private updateEventStats(eventId: string, success: boolean): void {
    const now = Date.now();
    this.eventUpdateTimes.set(eventId, now);

    if (success) {
      this.eventErrorCounts.delete(eventId);
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      
      // Адаптивно уменьшаем интервал при успехе
      if (this.consecutiveErrors === 0) {
        this.currentInterval = Math.max(
          UPDATE_INTERVAL_BASE,
          this.currentInterval * 0.9
        );
      }
    } else {
      const errorCount = (this.eventErrorCounts.get(eventId) || 0) + 1;
      this.eventErrorCounts.set(eventId, errorCount);
      this.consecutiveErrors++;

      // Адаптивно увеличиваем интервал при ошибках
      if (this.consecutiveErrors > 5) {
        this.currentInterval = Math.min(
          UPDATE_FAILURE_MAX_INTERVAL,
          this.currentInterval * 1.2
        );
      }

      // Очищаем старые ошибки
      if (errorCount > MAX_CONSECUTIVE_ERRORS) {
        this.eventErrorCounts.delete(eventId);
        this.priorityEvents[GameBetApiType.LIVE].delete(eventId);
        this.priorityEvents[GameBetApiType.LINE].delete(eventId);
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private processEvent(eventId: string, dataType: GameBetApiType): void {
    const now = Date.now();
    const lastUpdate = this.eventUpdateTimes.get(eventId) || 0;
    const timeSinceLastUpdate = now - lastUpdate;
    
    // Увеличиваем минимальный интервал для снижения нагрузки
    if (timeSinceLastUpdate < this.currentInterval) {
      return;
    }

    // Проверяем приоритет события
    const isPriority = this.priorityEvents[dataType].has(eventId);
    const priorityInterval = Math.max(100, this.currentInterval / 2); // Увеличиваем минимальный интервал до 100мс

    if (isPriority && timeSinceLastUpdate < priorityInterval) {
      return;
    }

    // Добавляем дополнительную проверку для снижения нагрузки
    const errorCount = this.eventErrorCounts.get(eventId) || 0;
    if (errorCount > 10) {
      // Пропускаем события с большим количеством ошибок
      return;
    }

    // Обрабатываем событие
    try {
      const startTime = Date.now();
      this.emit('event_update', { eventId, dataType, timestamp: now });
      const processingTime = Date.now() - startTime;

      // Увеличиваем порог для предупреждений о задержке
      if (processingTime > 10) { // Увеличиваем с 5мс до 10мс
        this.logger.warn(`High delay detected (${processingTime}ms), reducing interval to ${Math.max(100, this.currentInterval / 2)}ms`);
        this.currentInterval = Math.max(100, this.currentInterval / 2);
      }
        
      this.updateEventStats(eventId, true);
    } catch (error) {
      this.logger.error(`Error processing event ${eventId}:`, error);
      this.updateEventStats(eventId, false);
    }
  }

  private emitInitialEvent(
    eventId: string,
    data: GameBetApi,
    dataType: GameBetApiType
  ): void {
    const now = Date.now();
    const isPriority = this.priorityEvents[dataType].has(eventId);

    const event: BetApiWebSocketEvent = {
      id: eventId,
      eventId: eventId,
      type: 'event_update',
      data: {
        type: 'initial',
        gameData: data,
        dataType,
        isPriority
      },
      timestamp: now,
      dataType
    };

    this.wsAdapter.send(event);
    this.eventBuffer.set(`${eventId}:initial`, event);
  }
}