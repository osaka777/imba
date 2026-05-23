import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { BetApiWebSocketEvent, BetApiWebSocketStatus } from './types/betapi-websocket-event';
import { LRUCache } from 'lru-cache';
import { GameBetApiType } from '@prisma/client';

export interface WebSocketConfig {
  bufferSize: number;
  bufferTTL: number;
  maxBatchSize: number;
  batchInterval: number;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

const WS_PING_INTERVAL = 30000; // Увеличиваем интервал пинга до 30 секунд
const WS_PING_TIMEOUT = 60000; // Увеличиваем таймаут пинга до 60 секунд
const WS_QUEUE_SIZE = 2000; // Увеличиваем базовый размер очереди в 4 раза

@Injectable()
export class BetApiWebSocketAdapter extends EventEmitter {
  private readonly logger = new Logger(BetApiWebSocketAdapter.name);
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private lastPingTime = 0;
  private lastEventTime = 0;
  private reconnectAttempts = 0;
  private pingTimeoutTimer: NodeJS.Timeout | null = null;

  // Добавляем дедупликацию событий
  private eventDeduplication = new Map<string, number>();
  private readonly DEDUPLICATION_WINDOW = 100; // 100ms окно дедупликации

  private readonly eventBuffer = {
    [GameBetApiType.LIVE]: new LRUCache<string, BetApiWebSocketEvent>({
      max: this.config.bufferSize * 3, // Увеличиваем буфер для LIVE событий
      ttl: this.config.bufferTTL,
      updateAgeOnGet: true,
      ttlAutopurge: true
    }),
    [GameBetApiType.LINE]: new LRUCache<string, BetApiWebSocketEvent>({
      max: this.config.bufferSize * 4,
      ttl: this.config.bufferTTL * 2,
      updateAgeOnGet: true,
      ttlAutopurge: true
    })
  };

  private readonly eventQueue = {
    [GameBetApiType.LIVE]: new Set<string>(),
    [GameBetApiType.LINE]: new Set<string>()
  };
  
  // Оптимизируем интервалы обработки
  private readonly processingIntervals = {
    [GameBetApiType.LIVE]: Math.max(25, this.config.batchInterval / 4), 
    [GameBetApiType.LINE]: this.config.batchInterval * 2
  };

  // Увеличиваем размеры батчей
  private readonly batchSizes = {
    [GameBetApiType.LIVE]: this.config.maxBatchSize * 3, 
    [GameBetApiType.LINE]: this.config.maxBatchSize
  };

  constructor(private readonly config: WebSocketConfig) {
    super();
    this.setupProcessingIntervals();
  }

  private setupProcessingIntervals(): void {
    // Обработка LIVE событий
    setInterval(() => {
      this.processEventQueue(GameBetApiType.LIVE);
    }, this.processingIntervals[GameBetApiType.LIVE]);

    // Обработка LINE событий
    setInterval(() => {
      this.processEventQueue(GameBetApiType.LINE);
    }, this.processingIntervals[GameBetApiType.LINE]);
  }

  private convertDataType(type: GameBetApiType | 'live' | 'line' | undefined): GameBetApiType {
    if (type === undefined || type === 'live' || type === GameBetApiType.LIVE) {
      return GameBetApiType.LIVE;
    }
    return GameBetApiType.LINE;
  }

  connect(): void {
    if (this.connected) return;
    
    this.setupConnection();
    this.startPingInterval();
    this.connected = true;
    this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    this.emit('open');
    this.logger.debug('WebSocket adapter connected successfully');
  }

  private setupConnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }

    this.eventQueue[GameBetApiType.LIVE].clear();
    this.eventQueue[GameBetApiType.LINE].clear();
    this.eventBuffer[GameBetApiType.LIVE].clear();
    this.eventBuffer[GameBetApiType.LINE].clear();
    this.lastEventTime = Date.now();
  }

  private startPingInterval(): void {
    // Simplified health check - just update last ping time periodically
    this.pingTimer = setInterval(() => {
      this.lastPingTime = Date.now();
      this.lastEventTime = Date.now();
      
      // Log connection status periodically for monitoring
      if (this.lastPingTime % (WS_PING_INTERVAL * 10) === 0) {
        this.logger.debug('WebSocket adapter health check', {
          connected: this.connected,
          bufferSize: this.eventBuffer[GameBetApiType.LIVE].size + this.eventBuffer[GameBetApiType.LINE].size,
          queueSize: this.eventQueue[GameBetApiType.LIVE].size + this.eventQueue[GameBetApiType.LINE].size
        });
      }
    }, WS_PING_INTERVAL);
  }

  private ping(): void {
    // This is an internal event adapter, not a real WebSocket client
    // Just update the timestamp to indicate the adapter is active
    this.lastPingTime = Date.now();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private reconnect(): void {
    this.connected = false;
    this.emit('close');
    this.connect();
  }

  send(event: BetApiWebSocketEvent): void {
    if (!this.connected) {
      this.logger.warn('Cannot send event: not connected');
      return;
    }

    try {
      const dataType = this.convertDataType(event.dataType);
      const queue = this.eventQueue[dataType];
      const buffer = this.eventBuffer[dataType];

      // Динамические лимиты очереди в зависимости от нагрузки
      const baseLimit = dataType === GameBetApiType.LINE ? WS_QUEUE_SIZE * 2 : WS_QUEUE_SIZE;
      const currentLoad = queue.size / baseLimit;
      const queueLimit = currentLoad > 0.8 ? baseLimit * 1.5 : baseLimit; // Увеличиваем лимит при высокой нагрузке

      // Дедупликация событий - проверяем, не отправляли ли недавно похожее событие
      const eventKey = `${event.eventId}_${event.type}`;
      const now = Date.now();
      const lastSent = this.eventDeduplication.get(eventKey);
      
      if (lastSent && (now - lastSent) < this.DEDUPLICATION_WINDOW) {
        // Обновляем существующее событие вместо добавления нового
        const existingEventId = Array.from(buffer.keys()).find(id => id.startsWith(`${event.type}_${event.eventId}_`));
        if (existingEventId) {
          buffer.set(existingEventId, event);
          return;
        }
      }

      this.eventDeduplication.set(eventKey, now);

      // Очистка старых записей дедупликации
      if (this.eventDeduplication.size > 10000) {
        const cutoff = now - this.DEDUPLICATION_WINDOW * 10;
        for (const [key, timestamp] of this.eventDeduplication.entries()) {
          if (timestamp < cutoff) {
            this.eventDeduplication.delete(key);
          }
        }
      }

      if (queue.size < queueLimit) {
        buffer.set(event.id, event);
        queue.add(event.id);
        
        // Более агрессивная обработка для переполненных очередей
        const processingDelay = queue.size > queueLimit * 0.7 ? 
          Math.max(10, this.processingIntervals[dataType] / 2) : 
          this.processingIntervals[dataType];
        
        setTimeout(() => {
          this.processEventQueue(dataType);
        }, processingDelay);
      } else {
        // Улучшенная обработка переполнения
        if (dataType === GameBetApiType.LINE) {
          // Для LINE событий удаляем 30% самых старых
          const removeCount = Math.floor(queue.size * 0.3);
          const oldestEvents = Array.from(queue).slice(0, removeCount);
          oldestEvents.forEach(eventId => {
            queue.delete(eventId);
            buffer.delete(eventId);
          });
          
          buffer.set(event.id, event);
          queue.add(event.id);
        } else {
          // Для LIVE событий пытаемся заменить менее приоритетные события
          const priorityTypes = ['updateParsedScore', 'update_event', 'updateMarkets'];
          const currentPriority = priorityTypes.indexOf(event.type) !== -1 ? priorityTypes.indexOf(event.type) : 10;
          
          // Ищем событие с меньшим приоритетом для замены
          let replacedEvent = false;
          for (const existingEventId of queue) {
            const existingEvent = buffer.get(existingEventId);
            if (existingEvent) {
              const existingPriority = priorityTypes.indexOf(existingEvent.type) !== -1 ? priorityTypes.indexOf(existingEvent.type) : 10;
              if (existingPriority > currentPriority || (existingPriority === currentPriority && existingEvent.eventId === event.eventId)) {
                queue.delete(existingEventId);
                buffer.delete(existingEventId);
                buffer.set(event.id, event);
                queue.add(event.id);
                replacedEvent = true;
                break;
              }
            }
          }
          
          if (!replacedEvent) {
            // Принудительно обрабатываем очередь немедленно
            setImmediate(() => this.processEventQueue(dataType));
            this.logger.warn(`${dataType} event queue at capacity (${queue.size}), processing immediately`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to send event:', error);
      this.emit('error', error);
    }
  }

  private processEventQueue(dataType: GameBetApiType | 'live' | 'line'): void {
    const type = this.convertDataType(dataType);
    const queue = this.eventQueue[type];
    const buffer = this.eventBuffer[type];

    if (queue.size === 0) return;

    const eventIds = Array.from(queue);
    queue.clear();

    const batchSize = this.batchSizes[type];
    
    for (let i = 0; i < eventIds.length; i += batchSize) {
      const batch = eventIds.slice(i, i + batchSize);
      
      setTimeout(() => {
        this.processBatch(batch, buffer, type);
      }, i === 0 ? 0 : this.processingIntervals[type]);
    }
  }

  private processBatch(batch: string[], buffer: LRUCache<string, BetApiWebSocketEvent>, type: GameBetApiType): void {
    for (const eventId of batch) {
      const event = buffer.get(eventId);
      if (!event) continue;

      try {
        this.emit('message', JSON.stringify({
          ...event,
          dataType: type
        }));
        this.lastEventTime = Date.now();
      } catch (error) {
        this.logger.error(`Failed to process ${type} event:`, error);
        this.eventQueue[type].add(eventId);
      }
    }
  }

  getStatus(): BetApiWebSocketStatus {
    return {
      connected: this.connected,
      bufferSize: this.eventBuffer[GameBetApiType.LIVE].size + this.eventBuffer[GameBetApiType.LINE].size,
      queueSize: this.eventQueue[GameBetApiType.LIVE].size + this.eventQueue[GameBetApiType.LINE].size,
      lastEventTime: this.lastEventTime,
      reconnectAttempts: this.reconnectAttempts,
      dataType: GameBetApiType.LIVE
    };
  }

  getBufferedEvents(dataType?: 'live' | 'line'): BetApiWebSocketEvent[] {
    const type = this.convertDataType(dataType);
    if (dataType) {
      return Array.from(this.eventBuffer[type].values());
    }
    return [
      ...Array.from(this.eventBuffer[GameBetApiType.LIVE].values()),
      ...Array.from(this.eventBuffer[GameBetApiType.LINE].values())
    ];
  }

  clearBuffer(dataType?: 'live' | 'line'): void {
    if (dataType) {
      const type = this.convertDataType(dataType);
      this.eventBuffer[type].clear();
      this.eventQueue[type].clear();
    } else {
      this.eventBuffer[GameBetApiType.LIVE].clear();
      this.eventBuffer[GameBetApiType.LINE].clear();
      this.eventQueue[GameBetApiType.LIVE].clear();
      this.eventQueue[GameBetApiType.LINE].clear();
    }
  }

  disconnect(): void {
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }
    this.emit('close');
  }
}