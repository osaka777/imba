import { Injectable } from '@nestjs/common';
import { GameBetApiType } from '@prisma/client';
import { BetApiBaseService } from './betapi-base.service';
import { ConfigService } from '@nestjs/config';
import { GameService } from '~/main/game/game.service';
import { PrismaService } from '~/prisma/prisma.service';
import { BetApiWebSocketAdapter } from './betapi-websocket-adapter';
import { BetApiChangeDetector } from './betapi-change-detector';
import { OddsCorpGateway } from '~/integrations/odds-corp/odds-corp.gateway';
import { BetApiEvent, BetApiResponse } from './types/betapi.types';
import { LanguageService } from '~/shared/services/language.service';

@Injectable()
export class BetApiLineService extends BetApiBaseService {
  private readonly LINE_BATCH_SIZE = 5; // Обрабатываем по 5 спортов за раз

  constructor(
    configService: ConfigService,
    gameService: GameService,
    prismaService: PrismaService,
    wsAdapter: BetApiWebSocketAdapter,
    changeDetector: BetApiChangeDetector,
    oddsCorpGateway: OddsCorpGateway,
    languageService: LanguageService
  ) {
    super(
      configService,
      gameService,
      prismaService,
      wsAdapter,
      changeDetector,
      oddsCorpGateway,
      languageService,
      GameBetApiType.LINE,
      10000,  // TTL для LINE кэша
      50,     // Размер батча для LINE
      5000    // Интервал обновления для LINE
    );
  }

  async startUpdateTask(): Promise<void> {
    if (this.isProcessing) return;

    const run = async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        const sportIds = (this.configService.get<string>('BETAPI_SPORTS_IDS') || '1')
          .split(',')
          .map(id => Number(id.trim()))
          .filter(id => id > 0);

        // Обрабатываем спорты батчами
        for (let i = 0; i < sportIds.length; i += this.LINE_BATCH_SIZE) {
          const batch = sportIds.slice(i, i + this.LINE_BATCH_SIZE);
          
          try {
            const updatePromises = batch.map(sportId => 
              this.updateEvents(sportId)
            );
            await Promise.all(updatePromises);

            // Пауза между батчами спортов
            if (i + this.LINE_BATCH_SIZE < sportIds.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (error) {
            this.logger.error(`Error processing LINE sports batch ${i/this.LINE_BATCH_SIZE + 1}:`, error);
          }
        }
      } catch (error) {
        this.logger.error('LINE update task error:', error);
      } finally {
        this.isProcessing = false;
      }
    };

    // Запускаем обновление с интервалом
    setInterval(run, this.updateInterval);
    run(); // Первый запуск
  }

  async processEvents(events: BetApiEvent[]): Promise<void> {
    const batches = [];
    for (let i = 0; i < events.length; i += this.batchSize) {
      batches.push(events.slice(i, i + this.batchSize));
    }

    for (const batch of batches) {
      try {
        await this.processBatch(batch, 'prematch');
        // Большая пауза между батчами для LINE
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error('Error processing LINE batch:', error);
      }
    }
  }

  async updateEvents(sportId: number): Promise<void> {
    try {
      const response = await this.request<BetApiResponse>(`events/${sportId}/0/sub/1000`); // Увеличиваем pageLength
      
      if (!this.validateResponse(response)) {
        return;
      }

      const events: BetApiEvent[] = [];
      for (const tournament of response.body) {
        if (Array.isArray(tournament.events_list)) {
          events.push(...tournament.events_list);
        }
      }

      // Фильтруем и обновляем только актуальные события
      const now = Date.now();
      const filteredEvents = events.filter(event => {
        // Проверяем время начала события
        const startTime = event.game_start * 1000;
        return startTime > now && event.game_id === event.game_mid;
      });

      // Обновляем кэш и отправляем события
      for (const event of filteredEvents) {
        this.events.set(event.game_id, event);
        
        const mappedEvent = this.mapEventForChangeDetector(event);
        
        // Отправляем в WebSocket только если есть изменения
        await this.changeDetector.detectChanges(
          String(event.eventId || event.game_id),
          mappedEvent as any, // Type assertion needed due to change detector interface mismatch
          GameBetApiType.LINE,
          'group' // Групповые данные для главной страницы
        );
      }

      await this.processEvents(filteredEvents);
    } catch (error) {
      this.logger.error(`Error updating LINE events for sport ${sportId}:`, error);
    }
  }
}