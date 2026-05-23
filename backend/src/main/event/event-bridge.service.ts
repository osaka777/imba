import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { GameService } from '../game/game.service';
import { EventGateway } from './event.gateway';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class EventBridgeService implements OnModuleInit {
  private readonly gameCache = new Map<string, any>();
  private readonly lastUpdateTime = new Map<string, number>();
  private readonly heartbeatInterval = 30000; // 30 секунд
  private readonly maxCacheAge = 300000; // 5 минут

  constructor(
    private readonly gameService: GameService,
    private readonly eventGateway: EventGateway,
    private readonly prisma: PrismaService,
    @Inject('winston') private readonly logger: Logger
  ) {}

  onModuleInit() {
    this.startHeartbeat();
    this.startCacheCleanup();
  }

  /**
   * Улучшенная отправка обновлений с кэшированием и проверкой
   */
  async sendGameUpdate(eventId: string, updateType: 'score' | 'markets' | 'status', data: any) {
    try {
      const now = Date.now();
      const cacheKey = `${eventId}:${updateType}`;
      
      // Разные интервалы для разных типов обновлений
      let minInterval = 1000; // 1 секунда по умолчанию
      
      if (updateType === 'markets') {
        minInterval = 100; // 100мс для маркетов (коэффициентов)
      } else if (updateType === 'score') {
        minInterval = 500; // 500мс для счета
      }
      
      // Проверяем, не слишком ли часто отправляем обновления
      const lastUpdate = this.lastUpdateTime.get(cacheKey);
      if (lastUpdate && (now - lastUpdate) < minInterval) {
        this.logger.debug('Skipping duplicate update', { eventId, updateType, interval: now - lastUpdate, minInterval });
        return;
      }

      // Кэшируем обновление
      this.gameCache.set(cacheKey, { data, timestamp: now });
      this.lastUpdateTime.set(cacheKey, now);

      // Отправляем обновление
      await this.eventGateway.sendUpdate({
        eventId,
        type: this.mapUpdateType(updateType),
        payload: data
      });

      this.logger.debug('Game update sent', { eventId, updateType, timestamp: now });
    } catch (error) {
      this.logger.error('Failed to send game update', { eventId, updateType, error });
    }
  }

  /**
   * Отправка обновления счета с дополнительными проверками
   */
  async sendScoreUpdate(eventId: string, score: any, timer?: number) {
    try {
      // Проверяем, что игра существует в базе
      const game = await this.prisma.game.findUnique({
        where: { eventId: eventId },
        select: { eventId: true, status: true, sport: true }
      });

      if (!game) {
        this.logger.warn('Game not found for score update', { eventId });
        return;
      }

      // Парсим счет и создаем обновление
      const parsedScore = this.parseScore(game.sport, score, timer);
      
      await this.sendGameUpdate(eventId, 'score', parsedScore);
    } catch (error) {
      this.logger.error('Failed to send score update', { eventId, error });
    }
  }

  /**
   * Отправка обновления маркетов с валидацией
   */
  async sendMarketsUpdate(eventId: string, markets: any[]) {
    try {
      if (!markets || markets.length === 0) {
        this.logger.debug('No markets to update', { eventId });
        return;
      }

      // Преобразуем маркеты в правильный формат для frontend
      const formattedMarkets = markets.map(market => {
        // Если market это массив (старый формат)
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
        
        // Если market это объект (новый формат)
        if (typeof market === 'object') {
          return {
            market: market.market,
            cf: market.cf,
            isOpen: market.isOpen,
            display_name: market.display_name || market.market,
            oc_group_name: market.oc_group_name || 'Unknown',
            basis: market.basis || this.extractBasis(market.market)
          };
        }
        
        return market;
      });

      // Проверяем минимальные изменения коэффициентов
      const cacheKey = `${eventId}:markets`;
      const cachedData = this.gameCache.get(cacheKey);
      
      if (cachedData && cachedData.data) {
        let hasSignificantChanges = false;
        const oldMarkets = cachedData.data;
        
        // Проверяем изменения в каждом маркете
        for (const newMarket of formattedMarkets) {
          const oldMarket = this.findMarketInGrouped(oldMarkets, newMarket.market);
          if (oldMarket) {
            const cfDiff = Math.abs(Number(newMarket.cf) - Number(oldMarket.cf));
            // Игнорируем изменения меньше 0.01 (1 копейки)
            // Также игнорируем изменения в заблокированных рынках
            if (cfDiff >= 0.01 && newMarket.isOpen !== false) {
              hasSignificantChanges = true;
              break;
            }
          } else {
            // Новый маркет - считаем значительным изменением только если он открыт
            if (newMarket.isOpen !== false) {
              hasSignificantChanges = true;
              break;
            }
          }
        }
        
        // Если нет значительных изменений, пропускаем обновление
        if (!hasSignificantChanges) {
          this.logger.debug('Skipping markets update - no significant changes', { 
            eventId, 
            marketsCount: formattedMarkets.length 
          });
          return;
        }
      }

      // Группируем маркеты по типам
      const groupedMarkets = this.groupMarkets(formattedMarkets);
      
      this.logger.debug('Sending formatted markets update:', {
        eventId,
        marketsCount: formattedMarkets.length,
        groups: Object.keys(groupedMarkets),
        sampleMarket: formattedMarkets[0]
      });
      
      await this.sendGameUpdate(eventId, 'markets', groupedMarkets);
    } catch (error) {
      this.logger.error('Failed to send markets update', { 
        eventId, 
        error: error.message || error.toString(),
        stack: error.stack,
        errorType: error.constructor.name,
        marketsCount: markets?.length || 0
      });
    }
  }

  /**
   * Heartbeat для поддержания соединений
   */
  private startHeartbeat() {
    setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private async sendHeartbeat() {
    try {
      const activeGames = await this.getActiveGames();
      
      for (const game of activeGames) {
        const cacheKey = `${game.eventId}:heartbeat`;
        const lastHeartbeat = this.lastUpdateTime.get(cacheKey);
        const now = Date.now();
        
        if (!lastHeartbeat || (now - lastHeartbeat) > this.heartbeatInterval) {
                     await this.eventGateway.sendUpdate({
             eventId: game.eventId,
             type: 'heartbeat',
             payload: {
               timestamp: now,
               status: game.status,
               score: game.score
             }
           });
          
          this.lastUpdateTime.set(cacheKey, now);
        }
      }
    } catch (error) {
      this.logger.error('Heartbeat failed', { error });
    }
  }

  /**
   * Очистка старого кэша
   */
  private startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, data] of this.gameCache.entries()) {
        if (data.timestamp && (now - data.timestamp) > this.maxCacheAge) {
          this.gameCache.delete(key);
          this.lastUpdateTime.delete(key);
        }
      }
    }, 60000); // Очищаем каждую минуту
  }

  private async getActiveGames() {
    return await this.prisma.game.findMany({
      where: {
        status: {
          in: ['IN_PROGRESS', 'PREMATCH']
        }
      },
      select: {
        eventId: true,
        status: true,
        score: true
      }
    });
  }

  private mapUpdateType(updateType: string): string {
    const mapping = {
      'score': 'updateParsedScore',
      'markets': 'update_markets',
      'status': 'updateStatus'
    };
    return mapping[updateType] || updateType;
  }

  private parseScore(sport: string, score: any, timer?: number) {
    // Упрощенный парсинг счета
    if (typeof score === 'string') {
      const parts = score.split(' ');
      const mainScore = parts[0] || '0:0';
      
      return {
        text: {
          currentScore: mainScore,
          time: timer ? this.formatTime(timer) : '00:00'
        },
        currentScore: mainScore.split(':').map(s => parseInt(s) || 0),
        seconds: timer || 0
      };
    }
    
    return score;
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private groupMarkets(markets: any[]) {
    // Используем GameService.groupMarkets для правильной группировки
    return this.gameService.groupMarkets(markets);
  }

  /**
   * Извлекает basis из названия рынка
   */
  private extractBasis(marketName: string): string {
    if (!marketName) return 'UNKNOWN';
    
    // Извлекаем основную часть до первого подчеркивания
    const parts = marketName.split('__');
    if (parts.length > 0) {
      return parts[0];
    }
    
    return 'UNKNOWN';
  }

  /**
   * Ищет маркет в сгруппированных данных
   */
  private findMarketInGrouped(groupedMarkets: any, marketName: string): any {
    for (const groupKey in groupedMarkets) {
      const group = groupedMarkets[groupKey];
      if (Array.isArray(group)) {
        const found = group.find(market => market.market === marketName);
        if (found) return found;
      }
    }
    return null;
  }
}