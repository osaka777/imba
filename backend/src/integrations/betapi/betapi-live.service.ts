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
export class BetApiLiveService extends BetApiBaseService {
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
      GameBetApiType.LIVE,
      5000,  // TTL для LIVE кэша
      100,   // Размер батча для LIVE
      1000   // Интервал обновления для LIVE
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

        const updatePromises = sportIds.map(sportId => 
          this.updateEvents(sportId)
        );

        await Promise.all(updatePromises);
      } catch (error) {
        this.logger.error('LIVE update task error:', error);
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
        await this.processBatch(batch, 'live');
        // Небольшая пауза между батчами
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        this.logger.error('Error processing LIVE batch:', error);
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

      // Обновляем кэш и отправляем события
      for (const event of events) {
        if (event.game_id === event.game_mid) {
          this.events.set(event.game_id, event);
          
          const mappedEvent = this.mapEventForChangeDetector(event);
          
          // Отправляем в WebSocket только если есть изменения
          await this.changeDetector.detectChanges(
            String(event.eventId || event.game_id),
            mappedEvent as any, // Type assertion needed due to change detector interface mismatch
            GameBetApiType.LIVE,
            'group' // Групповые данные для главной страницы
          );
        }
      }

      await this.processEvents(events);
    } catch (error) {
      this.logger.error(`Error updating LIVE events for sport ${sportId}:`, error);
    }
  }
}