import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EventGateway } from '../../main/event/event.gateway';
import { BetApiService } from './betapi.service';
import { BetApiChangeDetector } from './betapi-change-detector';
import { GameBetApiType, GameBetApi } from '@prisma/client';

@Injectable()
export class BetApiDetailedService {
  private readonly logger = new Logger(BetApiDetailedService.name);
  private readonly trackedEvents = new Set<string>();
  private readonly updateIntervals = new Map<string, NodeJS.Timeout>();
  private readonly UPDATE_INTERVAL = 2000; // 2 секунды для детальных данных

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly eventGateway: EventGateway,
    private readonly betApiService: BetApiService,
    private readonly changeDetector: BetApiChangeDetector,
    @Inject('winston') private readonly logger2: Logger,
  ) {}

  /**
   * Начинает отслеживание детальных данных для конкретной игры
   */
  startTrackingEvent(eventId: string): void {
    if (this.trackedEvents.has(eventId)) {
      this.logger.debug(`Already tracking detailed data for event ${eventId}`);
      return;
    }

    this.trackedEvents.add(eventId);
    this.logger.log(`Started tracking detailed data for event ${eventId}`);

    // Запускаем периодическое обновление детальных данных
    const interval = setInterval(async () => {
      await this.updateDetailedEventData(eventId);
    }, this.UPDATE_INTERVAL);

    this.updateIntervals.set(eventId, interval);
  }

  /**
   * Останавливает отслеживание детальных данных для конкретной игры
   */
  stopTrackingEvent(eventId: string): void {
    if (!this.trackedEvents.has(eventId)) {
      return;
    }

    this.trackedEvents.delete(eventId);
    
    const interval = this.updateIntervals.get(eventId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(eventId);
    }

    this.logger.log(`Stopped tracking detailed data for event ${eventId}`);
  }

  /**
   * Получает список отслеживаемых событий
   */
  getTrackedEvents(): string[] {
    return Array.from(this.trackedEvents);
  }

  /**
   * Обновляет детальные данные для конкретного события
   */
  private async updateDetailedEventData(eventId: string): Promise<void> {
    try {
      // Получаем детальные данные через /sub эндпоинт
      const detailedData = await this.betApiService.fetchEventData(eventId);
      
      if (!detailedData || detailedData.status !== 1 || !detailedData.body) {
        this.logger.debug(`No detailed data available for event ${eventId}`);
        return;
      }

      // Преобразуем данные в формат GameBetApi
      const gameData = this.betApiService.prepareGameDataFromEvent(detailedData.body as GameBetApi);
      
      if (!gameData) {
        this.logger.debug(`Failed to prepare game data for event ${eventId}`);
        return;
      }

      // Добавляем обязательные поля для GameBetApi
      const gameDataWithTimestamps = {
        ...gameData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as GameBetApi;

      // Используем change detector для отслеживания изменений с типом 'detail'
      await this.changeDetector.detectChanges(
        eventId,
        gameDataWithTimestamps,
        GameBetApiType.LIVE,
        'detail'
      );

      this.logger.debug(`Updated detailed data for event ${eventId}`);
    } catch (error) {
      this.logger.error(`Error updating detailed data for event ${eventId}:`, error.message);
      
      // Если ошибка критическая, останавливаем отслеживание
      if (error.message.includes('404') || error.message.includes('not found')) {
        this.stopTrackingEvent(eventId);
      }
    }
  }

  /**
   * Отправляет детальное обновление через EventGateway
   */
  sendDetailedUpdate(eventId: string, type: string, payload: any): void {
    this.eventGateway.sendDetailedUpdate({
      eventId,
      type,
      payload
    });
  }

  /**
   * Очищает все отслеживаемые события при завершении работы
   */
  onModuleDestroy(): void {
    this.trackedEvents.forEach(eventId => {
      this.stopTrackingEvent(eventId);
    });
    this.logger.log('BetApiDetailedService destroyed, stopped all tracking');
  }
}