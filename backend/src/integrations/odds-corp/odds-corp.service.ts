import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Logger } from 'winston';

import { EventGateway } from '~/main/event/event.gateway';
import { EventBridgeService } from '~/main/event/event-bridge.service';
import { GameService } from '~/main/game/game.service';
import { BetProcessingService } from '~/integrations/betapi/bet-processing.service';

import { BetParser } from './bet-parser.service';
import { MessageIndexes } from './types/message-indexes';
import { MessageType } from './types/message-type';
import { UpdateEvent } from './types/update-event';

type MarketType = 'live' | 'prematch';

@Injectable()
export class OddsCorpService {
  private handlers: Record<
    MessageType,
    (marketType: MarketType, eventId: string, payload: unknown) => void
  > = {
    remove_event: this.handleRemoveEvent,
    remove_event_final: this.handleRemoveEventFinal,
    remove_markets: this.handleRemoveMarkets,
    update_event: this.handleUpdateEvent,
    update_markets: this.handleUpdateMarkets,
  };
  constructor(
    private readonly eventsGateway: EventGateway,
    private readonly eventBridge: EventBridgeService,
    private readonly betParser: BetParser,
    private readonly betProcessingService: BetProcessingService,
    private readonly gameService: GameService,
    @Inject('winston')
    private readonly logger: Logger,
  ) {}
  private async handleRemoveEvent(
    marketType: MarketType,
    eventId: string,
    payload: { received_from_parsers: boolean },
  ) {
    if (!payload.received_from_parsers) return;
    if (marketType === 'prematch') {
      await this.gameService.markStarting(eventId);
      return;
    }
    await this.gameService.markFinished(eventId);
    // Получаем информацию об игре для обработки ставок
    const game = await this.gameService.getGame(eventId);
    if (game) {
      // TODO: Implement specific bet finishing logic for game
      this.logger.info(`Game ${eventId} finished, bets will be processed by autoProcessStuckBets`);
    }
    await this.cancelStuckGames();
    return;
  }

  private async handleRemoveEventFinal(
    marketType: MarketType,
    eventId: string,
  ) {
    // TODO: activate when we will be sure, that app works fine
    if (marketType === 'prematch') return;
    return this.gameService.cleanUp(eventId);
  }

  private async handleRemoveMarkets(
    marketType: MarketType,
    eventId: string,
    payload: unknown,
  ) {
    if (payload == null || !Array.isArray(payload)) return;
    await this.gameService.removeMarkets(eventId, payload);
    await this.eventsGateway.sendUpdate({
      eventId,
      payload,
      type: 'removeMarkets',
    });
  }

  private async handleUpdateEvent(
    marketType: MarketType,
    eventId: string,
    payload: unknown,
  ) {
    if (!payload) return;
    if (typeof payload === 'object') {
      // First time event
      const event = payload as UpdateEvent;
      const game = {
        eventId,
        eventName: event.event_name,
        leagueName: event.league_name,
        meta: JSON.parse(event.meta),
        score: event.score,
        sport: event.sport,
        status: (
          {
            live: event.score ? 'IN_PROGRESS' : 'STARTING',
            prematch: 'PREMATCH',
          } as const
        )[marketType],
        team1: event.team1,
        team2: event.team2,
      };

      await this.gameService.create(game);
      // Отправляем через улучшенный мост для лучшей стабильности
      await this.eventBridge.sendGameUpdate(eventId, 'status', {
        ...game,
        parsedScore: this.betParser.parseScore(game.sport, game.score),
      });
      
      // Также отправляем через старый способ для совместимости
      await this.eventsGateway.sendUpdate({
        eventId,
        payload: {
          ...game,
          parsedScore: this.betParser.parseScore(game.sport, game.score),
        },
        type: 'newGame',
      });
    }
    if (typeof payload === 'string' && marketType === 'live') {
      // Score update
      const score = payload;
      const scoreUpdate = await this.gameService.updateScore(eventId, score);
      
      // Отправляем через улучшенный мост с таймером
      await this.eventBridge.sendScoreUpdate(eventId, score, scoreUpdate.newScore?.seconds);
      
      // Также отправляем через старый способ для совместимости
      await this.eventsGateway.sendUpdate({
        eventId,
        payload: scoreUpdate.newScore,
        type: 'updateParsedScore',
      });
      // TODO: Implement bet processing logic in betapi integration
    }
  }

  private async handleUpdateMarkets(
    marketType: MarketType,
    eventId: string,
    payload: unknown,
  ) {
    if (payload == null || !Array.isArray(payload)) {
      return;
    }

    // Логирование для отладки
    // console.log('==== HANDLE UPDATE MARKETS ====');
    // console.log('Raw payload:', payload);
    // console.log('Payload length:', payload.length);
    
    // const payloadString = JSON.stringify(payload);
    // if (payloadString.includes('Европейский')) {
    //   console.log('фраза "Европейский"');
    //   console.log('Контекст:', payloadString.substring(
    //     Math.max(0, payloadString.indexOf('Европейский') - 50),
    //     Math.min(payloadString.length, payloadString.indexOf('глов') + 50)
    //   ));
    // }
    
    // if (payload.length > 0) {
    //   console.log('First market raw data:', payload[0]);
    // }

    // Преобразуем все ставки без фильтрации
    const markets = payload.map(
      ([market, blocked, cf, meta, display_name, oc_group_name]: [string, number, number, string, string, string]) => {
        // Пытаемся распарсить ставку
        const parsed = this.betParser.parse(market);
        
        // Создаем объект ставки с базовыми полями
        const marketObj = {
          cf,
          isOpen: !blocked,
          market,
          display_name: display_name || market,
          oc_group_name: oc_group_name || 'OTHER',
          ...parsed,
        };
        
        // Если basis не определен или пустой, добавляем UNKNOWN_OTHER
        if (!marketObj.basis) {
          marketObj.basis = 'UNKNOWN_OTHER';
        }
        
        // Логируем каждую ставку для отладки
        // console.log('Processed market:', {
        //   market: marketObj.market,
        //   basis: marketObj.basis,
        //   isUnknown: marketObj.basis.startsWith('UNKNOWN_'),
        //   display_name: marketObj.display_name,
        //   oc_group_name: marketObj.oc_group_name
        // });
        
        return marketObj;
      },
    );
    
    // Логирование трансформированных данных
    // console.log('==== TRANSFORMED MARKETS ====');
    // console.log('Markets length:', markets.length);
    // if (markets.length > 0) {
    //   console.log('First transformed market:', markets[0]);
    //   console.log('Market fields:', Object.keys(markets[0]));
    //   console.log('Has display_name:', markets[0].display_name !== undefined);
    //   console.log('Has oc_group_name:', markets[0].oc_group_name !== undefined);
    // }
    
    // Группируем ставки
    const pl = this.gameService.groupMarkets(markets);
    
    // Логирование сгруппированных данных
    // console.log('==== GROUPED MARKETS ====');
    // console.log('Groups:', Object.keys(pl));
    
    // Обновляем ставки в сервисе
    await this.gameService.updateMarkets(eventId, markets);
    
    // Отправляем через улучшенный мост для стабильности
    await this.eventBridge.sendMarketsUpdate(eventId, markets);
    
    // Также отправляем через старый способ для совместимости
    await this.eventsGateway.sendUpdate({
      eventId,
      payload: pl,
      type: 'updateMarkets',
    });
  }

  @Interval(5 * 60 * 1000)
  async cancelStuckGames() {
    const ids = await this.gameService.clearStuckGames();
    if (ids && ids.length > 0) {
      this.logger.warn(`Processing ${ids.length} stuck games for bet cancellation`);
      // TODO: Implement specific bet cancellation logic for games
      this.logger.info(`Stuck games will be processed by autoProcessStuckBets: ${ids.join(', ')}`);
      await this.betProcessingService.autoProcessStuckBets();
    }
  }

  // Новый метод для обработки завершенных игр
  @Interval(3 * 60 * 1000) // Каждые 3 минуты
  async processFinishedGames() {
    try {
      // Находим игры со статусом FINISHED, которые имеют PENDING ставки
      const finishedGamesWithPendingBets = await this.gameService.getFinishedGamesWithPendingBets();
      
      if (finishedGamesWithPendingBets.length > 0) {
        this.logger.info(`Processing ${finishedGamesWithPendingBets.length} finished games with pending bets`);
        
        // Обрабатываем все зависшие ставки одним вызовом
        await this.betProcessingService.autoProcessStuckBets();
        this.logger.info(`Processed stuck bets for ${finishedGamesWithPendingBets.length} finished games`);
      }
    } catch (error) {
      this.logger.error('Error in processFinishedGames:', error);
    }
  }
  /**
   * Handles incoming data messages and performs corresponding actions based on the message type.
   *
   * @param data - An array of data representing the message.
   * @throws - Any error that occurs during message handling.
   * @returns Promise that resolves when message handling is complete.
   */
  async handle(marketType: MarketType, data: unknown[]): Promise<void> {
    const defaultLogMeta = {
      class: 'OddsCorpService',
      marketType,
      method: 'handle',
    };

    if (!data || typeof data !== 'object') return;
    if (!Array.isArray(data)) {
      // Ping
      this.logger.debug('Ping message', { ...defaultLogMeta, data });
      return;
    }

    // Extract relevant data from the message
    const messageType = data[MessageIndexes.TYPE] as MessageType;
    const eventId = data[MessageIndexes.BK_EVENT_ID];
    const payload = data[MessageIndexes.DATA];

    this.logger.debug('start handling message', {
      ...defaultLogMeta,
      eventId,
      messageType,
    });

    try {
      await this.handlers[messageType].call(this, marketType, eventId, payload);
    } catch (e) {
      this.logger.debug('error on handling message', {
        ...defaultLogMeta,
        bkEventId: eventId,
        e: e.toString(),
        messageType,
      });
    }
  }
}
