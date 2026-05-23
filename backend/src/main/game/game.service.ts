import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Game, GameStatus, Prisma } from '@prisma/client';
import { groupBy } from 'lodash';
import { Logger } from 'winston';

import { BetParser } from '~/integrations/odds-corp/bet-parser.service';
import { BetApiService } from '~/integrations/betapi/betapi.service';
import { PrismaService } from '~/prisma/prisma.service';
import { SubcategoryService } from '../subcategory/subcategory.service';
import { EventGateway } from '../event/event.gateway';
import { countriesData } from '../../data/countries';

import { MarketDto } from './dto/available-games.dto';
import { CreateGameDto } from './dto/available-games.dto';
import { GameNotFoundException } from './exception/game-not-found.exception';
import { determineCountryFromLeagueName } from './improved-country-detection';

const Opened = Symbol('OpenedMarkets');

@Injectable()
export class GameService {
  private marketsByGame: Record<
    string,
    { [Opened]: number } & Record<string, MarketDto>
  > = {};

  private nonExistentGameIds = new Set<string>();
  private cacheExpirationTime = 10 * 60 * 1000;

  ADMIN_CODE = this.configService.get<string>('ADMIN_CODE');

  constructor(
    private readonly betParser: BetParser,
    private readonly prismaService: PrismaService,
    @Inject('winston') private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly subcategoryService: SubcategoryService,
    private readonly moduleRef: ModuleRef,
    @Inject(forwardRef(() => EventGateway)) private readonly eventGateway: EventGateway,
  ) {
    // Очистка кэша каждые 10 минут
    setInterval(() => {
      this.logger.debug(`Clearing nonExistentGameIds cache (contained ${this.nonExistentGameIds.size} IDs)`);
      this.nonExistentGameIds.clear();
    }, this.cacheExpirationTime);

    // Инициализация при запуске
    this.initializeGameStatuses().catch(error => {
      this.logger.error('Error in initial game status update:', error);
    });
  }

  private async initializeGameStatuses() {
    try {
      const now = Math.floor(Date.now() / 1000);
      this.logger.info('Initializing game statuses...');

      // Обновляем будущие игры
      const futureGamesResult = await this.prismaService.$executeRaw`
        UPDATE "Game"
        SET status = 'PREMATCH'
        WHERE status IN ('IN_PROGRESS', 'STARTING')
          AND (meta->>'start_at')::bigint > ${now}
      `;
      this.logger.info(`Reset ${futureGamesResult} future games to PREMATCH`);

      // Обновляем старые игры
      const oldGamesResult = await this.prismaService.$executeRaw`
        UPDATE "Game"
        SET status = 'FINISHED'
        WHERE status IN ('IN_PROGRESS', 'STARTING', 'PREMATCH')
          AND (meta->>'start_at')::bigint < ${now - (3 * 60 * 60)}
      `;
      this.logger.info(`Finished ${oldGamesResult} old games`);

      // Обновляем текущие игры
      const liveGamesResult = await this.prismaService.$executeRaw`
        UPDATE "Game"
        SET status = 'IN_PROGRESS'
        WHERE status IN ('PREMATCH', 'STARTING')
          AND (meta->>'start_at')::bigint <= ${now}
          AND (meta->>'start_at')::bigint > ${now - (3 * 60 * 60)}
      `;
      this.logger.info(`Set ${liveGamesResult} games to IN_PROGRESS`);

      // Проверяем результаты
      const gameStats = await this.prismaService.game.groupBy({
        by: ['status'],
        _count: true,
      });

      this.logger.info('Current game status distribution:', gameStats);
    } catch (error) {
      this.logger.error('Error initializing game statuses:', error);
    }
  }





  // Метод для принудительного завершения конкретной игры
  async forceFinishGame(eventId: string) {
    this.logger.info(`Force finishing game: ${eventId}`);

    try {
      const game = await this.prismaService.game.findFirst({
        where: { eventId },
        include: {
          Bet: {
            where: { status: 'PENDING' }
          }
        }
      });

      if (!game) {
        throw new Error(`Game ${eventId} not found`);
      }

      // Обрабатываем зависшие ставки для этой игры
      if (game.Bet.length > 0) {
        this.logger.info(`Found ${game.Bet.length} pending bets for game ${eventId}`);
      }

      // Используем markFinished для корректного завершения игры с удалением подигр
      await this.markFinished(eventId);

      return { success: true, message: `Game ${eventId} finished successfully` };
    } catch (error) {
      this.logger.error(`Error force finishing game ${eventId}:`, error);
      throw error;
    }
  }

  // Метод для диагностики проблемных игр
  async diagnoseProblematicGames() {
    try {
      const now = Date.now();

      // Получаем все игры в статусе IN_PROGRESS или STARTING
      const problematicGames = await this.prismaService.game.findMany({
        where: {
          status: {
            in: ['IN_PROGRESS', 'STARTING']
          }
        },
        select: {
          eventId: true,
          sport: true,
          status: true,
          score: true,
          createdAt: true,
          updatedAt: true,
          meta: true,
          _count: {
            select: {
              Bet: {
                where: { status: 'PENDING' }
              }
            }
          }
        },
        orderBy: { updatedAt: 'asc' }
      });

      const diagnostics = problematicGames.map(game => {
        const updatedAgo = now - new Date(game.updatedAt).getTime();
        const createdAgo = now - new Date(game.createdAt).getTime();

        // Старые методы расчета удалены - теперь используется только BetAPI
        const shouldFinishByEmptyScore = false;
        const shouldFinishByCompleteScore = false;

        return {
            eventId: game.eventId,
            sport: game.sport,
            status: game.status,
          score: game.score || 'EMPTY',
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
          createdAgoMinutes: Math.round(createdAgo / (60 * 1000)),
          updatedAgoMinutes: Math.round(updatedAgo / (60 * 1000)),
          pendingBets: game._count.Bet,
          shouldFinishByEmptyScore,
          shouldFinishByCompleteScore
        };
      });

      // Группируем по статусам
      const byStatus = {
        shouldFinish: diagnostics.filter(d => d.shouldFinishByEmptyScore || d.shouldFinishByCompleteScore),
        needsAttention: diagnostics.filter(d => !d.shouldFinishByEmptyScore && !d.shouldFinishByCompleteScore && d.updatedAgoMinutes > 30),
        normal: diagnostics.filter(d => !d.shouldFinishByEmptyScore && !d.shouldFinishByCompleteScore && d.updatedAgoMinutes <= 30)
      };

      return {
        total: problematicGames.length,
        shouldFinish: byStatus.shouldFinish.length,
        needsAttention: byStatus.needsAttention.length,
        normal: byStatus.normal.length,
        details: byStatus
      };
    } catch (error) {
      this.logger.error('Error diagnosing problematic games:', error);
      throw error;
    }
  }

  async bulkUpsert(games: Prisma.GameCreateInput[]) {
    if (!games.length) return;

    try {
      // Дедуплицируем игры по eventId на уровне GameService
      const uniqueGames = new Map<string, Prisma.GameCreateInput>();
      games.forEach(game => {
        const eventId = game.eventId as string;
        if (eventId && !uniqueGames.has(eventId)) {
          uniqueGames.set(eventId, game);
        }
      });
      
      const deduplicatedGames = Array.from(uniqueGames.values());
      
      if (deduplicatedGames.length !== games.length) {
        this.logger.warn(`Deduplicated ${games.length - deduplicatedGames.length} duplicate games in bulkUpsert`);
      }

      // Создаем Map для отслеживания приоритетных категорий
      const prioritySports = new Map<string, boolean>();

      // Сначала обработаем subcategory для всех игр и подготовим odds
      for (const game of deduplicatedGames) {
        // Обрабатываем коэффициенты из BookiesAPI
        if (game.meta && typeof game.meta === 'object') {
          const meta = game.meta as any;
          
          // Если есть odds в корне объекта игры, добавляем их в meta
          if ((game as any).odds && typeof (game as any).odds === 'object') {
            meta.odds = (game as any).odds;
          }
          
          // Обрабатываем время начала события
          if (meta.game_start && !meta.startTime) {
            meta.startTime = new Date(meta.game_start * 1000);
          }
          
          game.meta = meta;
        }
        
        if (!game.subcategory && game.leagueName && game.sport) {
          try {
            // Проверяем, есть ли subcategory_code в meta данных (из BookiesAPI)
            let subcategoryCode = '';
            if (game.meta && typeof game.meta === 'object' && (game.meta as any).subcategory_code) {
              subcategoryCode = (game.meta as any).subcategory_code;
            } else {
              subcategoryCode = this.determineSubcategory(
                game.sport as string,
                game.leagueName as string
              );
            }
            
            // Находим данные о стране для флага
            const countryData = countriesData.find(c => c.code === subcategoryCode);
            
            const subcategory = await this.subcategoryService.findOrCreate(
              subcategoryCode,
              game.sport as string,
              countryData?.flag
            );
            
            // Добавим subcategoryId напрямую в данные
            (game as any).subcategoryId = subcategory.id;
            
            // Only set priority=1 if subcategory isPriority and code !== 'all'
            if (subcategory.isPriority && subcategory.code !== 'all') {
              (game as any).priority = 1;
              this.logger.debug(`Setting priority=1 for game ${game.eventId} from priority subcategory ${subcategoryCode}`);
            }
          } catch (error) {
            this.logger.error(`Error determining subcategory for game: ${error.message}`);
          }
        }
      }

      // Обновляем приоритет для всех игр в приоритетных категориях
      for (const game of deduplicatedGames) {
        if (game.sport && prioritySports.get(game.sport as string)) {
          (game as any).priority = 1;
          this.logger.debug(`Setting priority=1 for game ${game.eventId} from priority sport ${game.sport}`);
        }
      }

      const columns = [
        'eventId',
        'eventName',
        'leagueName',
        'sport',
        'team1',
        'team2',
        'score',
        'status',
        'meta',
        'priority',
        'subcategoryId',
        'createdAt',
        'updatedAt',
      ];

      const values: any[] = [];
      const valuePlaceholders = deduplicatedGames
        .map((game, i) => {
          columns.forEach((col) => {
            let val = (game as any)[col];
              // Для дат используем правильную логику
              if (col === 'createdAt') {
                // createdAt устанавливаем только для новых игр (будет переопределен в ON CONFLICT)
                val = new Date();
              } else if (col === 'updatedAt') {
                // updatedAt всегда текущее время
                val = new Date();
            }
            values.push(val ?? null);
          });
          const offset = i * columns.length;
          return `(${columns
            .map((_, j) => {
              // Приведение типов для разных колонок
              if (columns[j] === 'status') {
                return `$${offset + j + 1}::"GameStatus"`;
              } else if (
                columns[j] === 'createdAt' ||
                columns[j] === 'updatedAt'
              ) {
                return `$${offset + j + 1}::timestamp`;
              }
              return `$${offset + j + 1}`;
            })
            .join(', ')})`;
        })
        .join(',\n');

      const updates = columns
        .filter((col) => col !== 'eventId')
        .map((col) => {
          if (col === 'status') {
            return `"${col}" = EXCLUDED."${col}"::"GameStatus"`;
            } else if (col === 'updatedAt') {
            return `"${col}" = EXCLUDED."${col}"::timestamp`;
            } else if (col === 'createdAt') {
              // createdAt НЕ обновляем для существующих игр
              return `"${col}" = "Game"."${col}"`;
          }
          return `"${col}" = EXCLUDED."${col}"`;
        })
        .join(', ');

      const query = `
        INSERT INTO "Game" (${columns.map((col) => `"${col}"`).join(', ')})
        VALUES ${valuePlaceholders}
        ON CONFLICT ("eventId") DO UPDATE SET
          ${updates}
      `;

        // Увеличиваем таймаут для операции и добавляем более агрессивную обработку
        await Promise.race([
          this.prismaService.$executeRawUnsafe(query, ...values),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database operation timeout')), 30000); // Увеличиваем таймаут до 30 секунд
          })
        ]);
        
        this.logger.debug(`BulkUpsert completed: processed ${deduplicatedGames.length} games`);
        
        // Проверяем на проблемы с датами
        const problematicGames = deduplicatedGames.filter(game => {
          const gameData = game as any;
          if (gameData.createdAt && gameData.updatedAt) {
            const createdAt = new Date(gameData.createdAt);
            const updatedAt = new Date(gameData.updatedAt);
            return updatedAt < createdAt;
          }
          return false;
        });
        
        if (problematicGames.length > 0) {
          this.logger.warn(`Found ${problematicGames.length} games with problematic dates (updatedAt < createdAt)`);
          problematicGames.forEach(game => {
            this.logger.warn(`Problematic game: ${game.eventId}, createdAt: ${(game as any).createdAt}, updatedAt: ${(game as any).updatedAt}`);
          });
        }
        
        // Упрощенная очистка: только удаление старых live-игр без ставок
        try {
          const liveCleanupResult = await this.deleteOldLiveGames();
          if (liveCleanupResult.deleted > 0) {
            this.logger.debug(`BulkUpsert live cleanup: deleted ${liveCleanupResult.deleted} old live games`);
        }
      } catch (error) {
          this.logger.error('Error during bulkUpsert live cleanup:', error);
        }
      } catch (error) {
        this.logger.error('Error in bulkUpsert:', error);
        throw error;
      }
    }
  async cleanUp(eventId: string) {
    try {
      await this.prismaService.game.delete({ where: { eventId } });
      this.logger.info('Game has been deleted', { eventId });
    } catch {
      this.logger.debug("Game hasn't been deleted because bets exists", {
        eventId,
      });
    }
  }

  async clearStuckGames() {
    return this.prismaService.$transaction(async (prisma) => {
      // Увеличиваем время до 30 минут для отмены игр
      const threshold = new Date(Date.now() - 30 * 60 * 1000);

      // Только отменяем игры, которые точно застряли в статусе STARTING более 30 минут
      const updatedGames = await prisma.$queryRaw<{ eventId: string }[]>`
        WITH updated AS (
          UPDATE "Game"
          SET status = 'CANCELED'
          WHERE 
            score = '' 
            AND status = 'STARTING' 
            AND "updatedAt" < ${threshold}
            AND "createdAt" < ${threshold}
          RETURNING "eventId"
        )
        SELECT "eventId" FROM updated
      `;

      if (updatedGames.length > 0) {
        this.logger.warn(`Canceled ${updatedGames.length} stuck games that were in STARTING status for over 30 minutes`);
        // Логируем каждую отмененную игру для мониторинга
        updatedGames.forEach(game => {
          this.logger.warn(`Canceled stuck game: ${game.eventId}`);
        });
      }

      return updatedGames.map((game) => game.eventId);
    });
  }

  async getFinishedGamesWithPendingBets() {
    return this.prismaService.game.findMany({
      where: {
        status: 'FINISHED',
        Bet: {
          some: {
            status: 'PENDING'
          }
        }
      },
      select: {
        eventId: true,
        sport: true,
        score: true,
        updatedAt: true,
        _count: {
          select: {
            Bet: {
              where: {
                status: 'PENDING'
              }
            }
          }
        }
      },
      take: 50 // Ограничиваем количество для производительности
    });
  }

  closeMarkets(eventId: string, period: number) {
    if (this.marketsByGame[eventId] == null) return;
    const marketsToRemove = Object.values(this.marketsByGame[eventId])
      .map(({ market, period_no }) => {
        if (period_no && +period_no <= period) {
          return market;
        }
      })
      .filter(Boolean);
    this.removeMarkets(eventId, marketsToRemove);
  }

  async create(gameData: Prisma.GameCreateInput) {
    if (!gameData.subcategory && gameData.leagueName && gameData.sport) {
      try {
        const subcategoryCode = this.determineSubcategory(
          gameData.sport as string, 
          gameData.leagueName as string
        );
        
        // Находим данные о стране для флага
        const countryData = countriesData.find(c => c.code === subcategoryCode);
        
        const subcategory = await this.subcategoryService.findOrCreate(
          subcategoryCode,
          gameData.sport as string,
          countryData?.flag
        );
        
        gameData.subcategory = { 
          connect: { id: subcategory.id } 
        };
      } catch (error) {
        this.logger.error(`Error determining subcategory for new game: ${error.message}`);
      }
    }

    // Логируем stat_list перед сохранением
    const meta = gameData.meta as any;

    const game = await this.prismaService.game.upsert({
      create: gameData,
      update: gameData,
      where: { eventId: gameData.eventId },
    });

    return game;
  }

  async createGameWithMarkets(dto: CreateGameDto) {
    const { markets, ...gameData } = dto;
    
    // Определяем подкатегорию, если она не указана и есть название лиги
    let subcategoryId: number | null = null;
    let subcategoryPriority = false;
    let sportPriority = false;
    
    if (gameData.leagueName && gameData.sport) {
      try {
        const subcategoryCode = this.determineSubcategory(
          gameData.sport, 
          gameData.leagueName
        );
        
        // Находим данные о стране для флага
        const countryData = countriesData.find(c => c.code === subcategoryCode);
        
        const subcategory = await this.subcategoryService.findOrCreate(
          subcategoryCode,
          gameData.sport,
          countryData?.flag 
        );
        
        subcategoryId = subcategory.id;
        subcategoryPriority = subcategory.isPriority && subcategory.code !== 'all';
        
        if (subcategoryPriority) {
          gameData.priority = 1;
          sportPriority = true;
          this.logger.debug(`Setting priority=1 for game ${gameData.eventId} from priority subcategory ${subcategoryCode}`);
        }
      } catch (error) {
        this.logger.error(`Error determining subcategory for new game: ${error.message}`);
      }
    }
    
    const existingGame = await this.prismaService.game.findFirst({
      where: { eventId: gameData.eventId },
      include: {
        subcategory: true
      }
    });

    if (existingGame) {
      const needsUpdate = 
        existingGame.status !== gameData.status ||
        existingGame.score !== gameData.score ||
        existingGame.team1 !== gameData.team1 ||
        existingGame.team2 !== gameData.team2 ||
        existingGame.leagueName !== gameData.leagueName ||
        existingGame.eventName !== gameData.eventName ||
        (subcategoryId && existingGame.subcategoryId !== subcategoryId) ||
        (subcategoryPriority && existingGame.priority !== 1) ||
        (sportPriority && existingGame.priority !== 1);

      if (needsUpdate) {
        const updateData = {
          ...gameData,
          status: gameData.status || existingGame.status,
          score: gameData.score || existingGame.score,
          team1: gameData.team1 || existingGame.team1,
          team2: gameData.team2 || existingGame.team2,
          leagueName: gameData.leagueName || existingGame.leagueName,
          eventName: gameData.eventName || existingGame.eventName,
          ...(subcategoryId ? { 
            subcategory: {
              connect: { id: subcategoryId }
            }
          } : {}),
          priority: (subcategoryPriority || sportPriority) ? 1 : (gameData.priority || existingGame.priority || 0),
          meta: {
            ...(existingGame.meta as any || {}),
            ...(gameData.meta as any || {})
          }
        };

        await this.prismaService.game.update({
          where: { eventId: gameData.eventId },
          data: updateData
        });
      }
    } else {
      // Создаем новую игру
      await this.prismaService.game.create({
        data: {
          ...gameData,
          subcategory: subcategoryId ? {
            connect: { id: subcategoryId }
          } : undefined,
          priority: (subcategoryPriority || sportPriority) ? 1 : (gameData.priority || 0)
        }
      });
    }

    // Обновляем рынки
    if (markets && markets.length > 0) {
      await this.updateMarkets(gameData.eventId, markets);
    }
  }
  async findGame(eventName: string | undefined, league: string | undefined) {
    const games = await this.prismaService.game.findMany({
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      where: {
        OR: [
          {
            eventName: {
              contains: eventName,
              mode: 'insensitive',
            },
          },
          {
            leagueName: {
              contains: league,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    return games.map((game) => {
      return {
        ...game,
        markets: this.marketsByGame[game.eventId] ?? {},
        parsedScore: this.betParser.parseScore(game.sport, game.score),
      };
    });
  }

  private async updateGameStatusIfNeeded(game: any) {
    if (game.status === 'STARTING' || game.status === 'IN_PROGRESS') {
      // Старые методы расчета удалены - теперь используется только BetAPI
      // Автоматическое завершение игр отключено
      if (false) {
          await this.prismaService.game.update({
            where: { eventId: game.eventId },
          data: {
            status: 'FINISHED',
            updatedAt: new Date()
          }
          });

        this.logger.debug(`Game ${game.eventId} (${game.sport}) marked as FINISHED in updateGameStatusIfNeeded`);
        
        // Обрабатываем зависшие ставки для этой игры
        try {
          // TODO: Implement bet processing logic in betapi integration
          this.logger.info(`Processed stuck bets for game ${game.eventId}`);
        } catch (error) {
          this.logger.error(`Error processing stuck bets for game ${game.eventId}:`, error);
        }
        
          return { ...game, status: 'FINISHED' };
      }
    }
    return game;
  }

  private async getGamesBase(
    sport: Prisma.StringFilter<'Game'> | string,
    limit: number,
    offset: number,
    status: 'PREMATCH' | 'IN_PROGRESS' | 'STARTING' | ('IN_PROGRESS' | 'STARTING')[],
    includeSubcategory = false,
    lastCreatedAt?: Date,
    subcategoryId?: number
  ) {
    const currentDate = new Date();
    const pastDate = new Date(currentDate);
    pastDate.setHours(pastDate.getHours() - 12);
    const minDate = lastCreatedAt ? (pastDate < lastCreatedAt ? pastDate : lastCreatedAt) : pastDate;

    this.logger.debug(`[getGamesBase] Getting games with params:`, {
      sport,
      limit,
      offset,
      status,
      lastCreatedAt: lastCreatedAt?.toISOString(),
      currentDate: currentDate.toISOString(),
      minDate: minDate.toISOString()
    });

    // Сначала получаем все игры без сортировки
    const games = await this.prismaService.game.findMany({
      where: {
        createdAt: {
          gt: minDate,
        },
        sport: sport || undefined,
        status: Array.isArray(status) ? { in: status } : status,
        subcategoryId: subcategoryId || undefined,
      },
      include: includeSubcategory ? {
        subcategory: {
          select: {
            id: true,
            code: true,
            name: true,
            sport: true,
            type: true,
            flag: true,
            isActive: true,
            isPriority: true
          }
        }
      } : undefined
    });

    // Сортируем игры вручную
    const sortedGames = games.sort((a, b) => {
      // Сначала по приоритету
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;

      // Затем по времени создания (новые игры сначала)
      const timeCreateDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeCreateDiff !== 0) return timeCreateDiff;

      // В конце по времени начала из meta (более поздние игры сначала)
      const aMeta = typeof a.meta === 'object' ? a.meta : {};
      const bMeta = typeof b.meta === 'object' ? b.meta : {};
      const aStartAt = (aMeta as any)?.raw_start_at || '';
      const bStartAt = (bMeta as any)?.raw_start_at || '';
      if (aStartAt && bStartAt) {
        return bStartAt > aStartAt ? -1 : bStartAt < aStartAt ? 1 : 0;
      }
      return 0;
    });

    // Применяем пагинацию
    const paginatedGames = sortedGames.slice(
      typeof offset === 'string' ? parseInt(offset, 10) : offset || 0,
      (typeof offset === 'string' ? parseInt(offset, 10) : offset || 0) + (typeof limit === 'string' ? parseInt(limit, 10) : limit || 10)
    );

    // Обновляем статусы и добавляем дополнительные данные
    const updatedGames = await Promise.all(
      paginatedGames.map(game => this.updateGameStatusIfNeeded(game))
    );

    // Загружаем рынки из базы данных для игр, у которых нет рынков в памяти
    const gamesWithoutMarkets = updatedGames.filter(game => !this.marketsByGame[game.eventId] || Object.keys(this.marketsByGame[game.eventId]).length <= 1);
    
    if (gamesWithoutMarkets.length > 0) {
      const gameMarkets = await this.prismaService.gameMarkets.findMany({
        where: {
          eventId: { in: gamesWithoutMarkets.map(g => g.eventId) }
        }
      });
      
      // Заполняем кэш рынками из базы данных
      gameMarkets.forEach(gm => {
        if (!this.marketsByGame[gm.eventId]) {
          this.marketsByGame[gm.eventId] = { [Opened]: 0 };
        }
        
        if (Array.isArray(gm.markets)) {
          gm.markets.forEach((market: any) => {
            this.marketsByGame[gm.eventId][market.market] = market;
            if (market.isOpen) {
              this.marketsByGame[gm.eventId][Opened] += 1;
            }
          });
        }
      });
      
      this.logger.debug(`Loaded markets from database for ${gameMarkets.length} games`);
    }

    // Получаем данные о подыграх для всех игр
    const gameEventIds = updatedGames.map(game => game.eventId);
    let subGamesMap = new Map();
    
    if (gameEventIds.length > 0) {
      try {
        const allSubGames = await this.prismaService.subGame.findMany({
          where: { parentEventId: { in: gameEventIds } },
          orderBy: { gameNum: 'asc' }
        });

        // Группируем подыгры по родительскому eventId
        allSubGames.forEach(subGame => {
          if (!subGamesMap.has(subGame.parentEventId)) {
            subGamesMap.set(subGame.parentEventId, []);
          }
          
          // Проверяем, свежие ли данные (не старше 5 минут)
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          if (subGame.updatedAt.getTime() > fiveMinutesAgo) {
            subGamesMap.get(subGame.parentEventId).push({
              game_id: subGame.gameId,
              subGameDbId: subGame.id, // ID записи в таблице SubGame для корректной передачи в ставках
              game_num: subGame.gameNum,
              game_name: subGame.gameName,
              game_start: subGame.gameStart,
              status: subGame.status,
              score: subGame.score,
              markets: subGame.markets,
              ...(subGame.meta && typeof subGame.meta === 'object' ? subGame.meta : {})
            });
          }
        });
        
        this.logger.debug(`Loaded sub-games for ${subGamesMap.size} games out of ${gameEventIds.length} total games`);
      } catch (subGameError) {
        this.logger.warn(`Error loading sub-games for games: ${subGameError.message}`);
      }
    }

    return updatedGames.map((game) => ({
      ...game,
      markets: this.marketsByGame[game.eventId] ?? {},
      parsedScore: this.betParser.parseScore(game.sport, game.score),
      sub_games: subGamesMap.get(game.eventId) || [],
    }));
  }

  async getAvailableGames(
    sport: Prisma.StringFilter<'Game'> | string,
    limit: number,
    offset: number,
    lastCreatedAt?: Date,
  ) {
    // Автоматически удаляем старые live-игры перед выдачей списка
    // ВРЕМЕННО ОТКЛЮЧЕНО: await this.deleteOldLiveGames();
    return this.getGamesBase(
      sport,
      limit,
      offset,
      ['IN_PROGRESS', 'STARTING'],
      true,
      lastCreatedAt
    );
  }

  async getFutureGames(
    sport: Prisma.StringFilter<'Game'> | string,
    limit: number,
    offset: number,
    lastCreatedAt?: Date,
  ) {
    return this.getGamesBase(
      sport,
      limit,
      offset,
      'PREMATCH',
      false,
      lastCreatedAt
    );
  }

  async getAvailableGamesBySubcategory(
    sport: string,
    subcategory: string,
    limit: number,
    offset: number,
    lastCreatedAt?: Date,
  ) {
    const subcategoryObj = await this.getSubcategoryOrLog(sport, subcategory);
    if (!subcategoryObj) return [];
    
    return this.getGamesBase(
      sport,
      limit,
      offset,
      ['IN_PROGRESS', 'STARTING'],
      true,
      lastCreatedAt,
      subcategoryObj.id
    );
  }

  async getFutureGamesBySubcategory(
    sport: string,
    subcategory: string,
    limit: number,
    offset: number,
    lastCreatedAt?: Date,
  ) {
    const subcategoryObj = await this.getSubcategoryOrLog(sport, subcategory);
    if (!subcategoryObj) return [];
    
    return this.getGamesBase(
      sport,
      limit,
      offset,
      'PREMATCH',
      true,
      lastCreatedAt,
      subcategoryObj.id
    );
  }

  private async getSubcategoryOrLog(sport: string, subcategory: string) {
    const subcategoryObj = await this.prismaService.subcategory.findFirst({
      where: {
        code: subcategory,
        sport: sport,
        isActive: true,
      },
    });

    if (!subcategoryObj) {
      this.logger.warn(`Subcategory not found: ${sport}/${subcategory}`);
      const allSubcategories = await this.prismaService.subcategory.findMany({
        where: { sport },
        select: { id: true, code: true, name: true },
      });
      this.logger.debug(`Available subcategories for ${sport}:`, 
        allSubcategories.map(s => `${s.code} (${s.name}): ID ${s.id}`).join(', '));
      return null;
    }

    return subcategoryObj;
  }

  async getGame(eventId: string) {
    try {
      this.logger.debug(`Attempting to find game with eventId: ${eventId}`);
      
      const game = await this.prismaService.game.findFirst({
        where: { eventId },
      });
      
      if (game == null) {
        // Проверяем, есть ли ID в кэше несуществующих игр
        if (this.nonExistentGameIds.has(eventId)) {
          this.logger.warn(`Game with ID ${eventId} is in nonExistent cache and not found in DB`);
        } else {
          // Добавляем ID в кэш несуществующих игр только если его действительно нет
          this.nonExistentGameIds.add(eventId);
          this.logger.warn(`Game not found with eventId: ${eventId}. Adding to nonExistent cache.`);
        }
        throw new GameNotFoundException();
      }
      
      // Если игра найдена, удаляем её из кэша несуществующих (если она там была)
      if (this.nonExistentGameIds.has(eventId)) {
        this.nonExistentGameIds.delete(eventId);
        this.logger.debug(`Removed game ${eventId} from nonExistent cache as it was found in DB`);
      }
      
      let markets = this.marketsByGame[game.eventId] ?? {};
      
      // Если рынков нет в памяти, загружаем из базы данных
      if (!markets || Object.keys(markets).length <= 1) {
        const gameMarkets = await this.prismaService.gameMarkets.findFirst({
          where: { eventId: game.eventId }
        });
        
        if (gameMarkets && Array.isArray(gameMarkets.markets)) {
          // Заполняем кэш рынками из базы данных
          this.marketsByGame[game.eventId] = { [Opened]: 0 };
          gameMarkets.markets.forEach((market: any) => {
            this.marketsByGame[game.eventId][market.market] = market;
            if (market.isOpen) {
              this.marketsByGame[game.eventId][Opened] += 1;
            }
          });
          markets = this.marketsByGame[game.eventId];
          this.logger.debug(`Loaded markets from database for game ${game.eventId}`);
        }
      }
      
      const groupedMarkets = (game.meta as any)?.groupedMarkets || {};
      
      // Получаем данные о подыграх
      let subGames = [];
      try {
        const cachedSubGames = await this.prismaService.subGame.findMany({
          where: { parentEventId: eventId },
          orderBy: { gameNum: 'asc' }
        });

        if (cachedSubGames.length > 0) {
          // Проверяем, свежие ли данные (не старше 5 минут)
          const latestUpdate = Math.max(...cachedSubGames.map(sg => sg.updatedAt.getTime()));
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          
          if (latestUpdate > fiveMinutesAgo) {
            subGames = cachedSubGames.map(sg => ({
              game_id: sg.gameId,
              game_num: sg.gameNum,
              game_name: sg.gameName,
              game_start: sg.gameStart,
              status: sg.status,
              score: sg.score,
              markets: sg.markets,
              ...(sg.meta && typeof sg.meta === 'object' ? sg.meta : {})
            }));
            this.logger.debug(`Loaded ${subGames.length} cached sub-games for game ${eventId}`);
          } else {
            this.logger.debug(`Sub-games cache expired for game ${eventId}, will fetch fresh data if needed`);
          }
        }
      } catch (subGameError) {
        this.logger.warn(`Error loading sub-games for game ${eventId}: ${subGameError.message}`);
      }
      
      return {
        ...game,
        markets,
        groupedMarkets,
        openedMarkets: markets[Opened],
        parsedScore: this.betParser.parseScore(game.sport, game.score),
        sub_games: subGames,
      };
    } catch (error) {
      if (error instanceof GameNotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error getting game with eventId ${eventId}: ${error.message}`);
      throw new GameNotFoundException();
    }
  }

  async getGames(eventIds: string[]) {
    try {
      this.logger.debug(`Attempting to find games with eventIds: ${eventIds.join(', ')}`);
      
      // Проверяем входные данные
      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        this.logger.warn('Empty or invalid eventIds array provided to getGames');
        return [];
      }
      
      // Отфильтровываем ID, которые уже находятся в кэше несуществующих
      const cachedNonExistentIds = eventIds.filter(id => this.nonExistentGameIds.has(id));
      if (cachedNonExistentIds.length > 0) {
        this.logger.debug(`Skipping ${cachedNonExistentIds.length} games that are in nonExistent cache: ${cachedNonExistentIds.join(', ')}`);
      }
      
      // Получаем только ID, которых нет в кэше несуществующих
      const filteredIds = eventIds.filter(id => !this.nonExistentGameIds.has(id));
      
      // Если все ID были в кэше несуществующих, сразу возвращаем пустой массив
      if (filteredIds.length === 0) {
        this.logger.warn('All requested eventIds are in nonExistent cache');
        return [];
      }
      
      const games = await this.prismaService.game.findMany({
        where: { eventId: { in: filteredIds } },
      });
      
      this.logger.debug(`Found ${games.length} games out of ${filteredIds.length} requested`);
      
      // Если есть ID игр, которые не были найдены, логируем их и добавляем в кэш
      if (games.length < filteredIds.length) {
        const foundIds = games.map(g => g.eventId);
        const missingIds = filteredIds.filter(id => !foundIds.includes(id));
        
        // Добавляем отсутствующие ID в кэш
        missingIds.forEach(id => this.nonExistentGameIds.add(id));
        
        this.logger.warn(`Following gameIds were not found and added to nonExistent cache: ${missingIds.join(', ')}`);
      }

      return games.map((game) => {
        const markets = this.marketsByGame[game.eventId] ?? {};
        const groupedMarkets = (game.meta as any)?.groupedMarkets || {};
        return {
          ...game,
          markets,
          groupedMarkets,
          parsedScore: this.betParser.parseScore(game.sport, game.score),
        };
      });
    } catch (error) {
      this.logger.error(`Error getting multiple games: ${error.message}`);
      return [];
    }
  }

  async getSubGame(gameId: string) {
    try {
      // Сначала проверяем, есть ли данные в базе
      const existingSubGame = await this.prismaService.subGame.findFirst({
        where: { subEventId: gameId }
      });

      // Если данные есть и они свежие (менее 5 минут), возвращаем их
      if (existingSubGame && existingSubGame.updatedAt) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (existingSubGame.updatedAt > fiveMinutesAgo) {
          this.logger.debug(`Returning cached sub-game data for ${gameId}`);
          return this.transformSubGameToApiResponse(existingSubGame);
        }
      }

      // Получаем данные из внешнего API
      const betApiService = this.moduleRef.get(BetApiService, { strict: false });
      const data = await betApiService.fetchSubGameData(gameId);

      // Проверяем статус ответа от BetAPI
      if (data && data.status === 99) {
        // Статус 99 означает, что подигра не найдена
        this.logger.debug(`Sub-game ${gameId} not found in BetAPI (status 99)`);
        
        // Удаляем устаревшие данные из кэша, если они есть
        if (existingSubGame) {
          await this.prismaService.subGame.delete({
            where: { id: existingSubGame.id }
          });
          this.logger.debug(`Removed outdated sub-game ${gameId} from cache`);
        }
        
        throw new GameNotFoundException(`Подигра с ID ${gameId} не найдена. Возможно, игра завершена или данные еще не обновились.`);
      }

      // Если данные получены успешно, сохраняем их в базу
      if (data && (data.status === 0 || data.status === 1) && data.body) {
        await this.createOrUpdateSubGame(data.body, gameId);
      }

      return data;
    } catch (error) {
      // Если это уже GameNotFoundException, пробрасываем её дальше
      if (error instanceof GameNotFoundException) {
        throw error;
      }
      
      this.logger.error(`Error getting sub game data for ${gameId}: ${error.message}`);
      
      // Если есть кэшированные данные, возвращаем их даже если они устарели
      const fallbackSubGame = await this.prismaService.subGame.findFirst({
        where: { subEventId: gameId }
      });
      
      if (fallbackSubGame) {
        this.logger.debug(`Returning fallback cached data for ${gameId}`);
        return this.transformSubGameToApiResponse(fallbackSubGame);
      }
      
      throw new GameNotFoundException(`Подигра с ID ${gameId} не найдена. Возможно, игра завершена или данные еще не обновились.`);
    }
  }

  private async createOrUpdateSubGame(gameData: any, gameId: string) {
    try {
      // Получаем данные родительской игры для заполнения полей
      const parentEventId = gameData.parent_event_id || gameId;
      let parentGame = null;
      
      try {
        parentGame = await this.prismaService.game.findFirst({
          where: { eventId: parentEventId }
        });
      } catch (error) {
        this.logger.warn(`Could not find parent game ${parentEventId}: ${error.message}`);
      }

      // Логирование для отладки eventName
      this.logger.info(`[DEBUG] createOrUpdateSubGame for gameId: ${gameId}`);
      this.logger.info(`[DEBUG] parentEventId: ${parentEventId}`);
      this.logger.info(`[DEBUG] parentGame?.eventName: ${parentGame?.eventName}`);
      this.logger.info(`[DEBUG] gameData.event_name: ${gameData.event_name}`);
      this.logger.info(`[DEBUG] gameData.eventName: ${gameData.eventName}`);
      this.logger.info(`[DEBUG] gameData.name: ${gameData.name}`);

      // Подготавливаем данные для сохранения
      const subGameData = {
        parentEventId: parentEventId,
        subEventId: gameId,
        gameId: parseInt(gameData.game_id || gameData.id || gameId),
        gameNum: gameData.game_num || 1,
        gameName: gameData.game_name || gameData.event_name || gameData.name || '',
        gameStart: gameData.game_start || gameData.start_time,
        status: gameData.status || 'active',
        score: gameData.score || '',
        
        // Данные из родительской игры для отображения
        eventName: parentGame?.eventName || gameData.event_name || gameData.eventName || '',
        leagueName: parentGame?.leagueName || gameData.league_name || '',
        sport: parentGame?.sport || gameData.sport || '',
        team1: parentGame?.team1 || gameData.team1_name || gameData.opp_1_name || '',
        team2: parentGame?.team2 || gameData.team2_name || gameData.opp_2_name || '',
        
        // Дополнительные данные
        startTime: gameData.game_start ? new Date(gameData.game_start * 1000) : 
                   gameData.start_time ? new Date(gameData.start_time * 1000) : 
                   parentGame?.createdAt || new Date(),
        priority: parentGame?.priority || 0,
        
        markets: gameData.markets || gameData.game_oc_list || null,
        meta: {
          ...gameData.meta,
          originalData: gameData,
          parentGameData: parentGame ? {
            eventName: parentGame.eventName,
            leagueName: parentGame.leagueName,
            sport: parentGame.sport,
            team1: parentGame.team1,
            team2: parentGame.team2,
            score: parentGame.score,
            priority: parentGame.priority
          } : null,
          fetchedAt: new Date().toISOString()
        },
        updatedAt: new Date()
      };

      // Логируем финальное значение eventName
      this.logger.info(`[DEBUG] Final eventName for subGame ${gameId}: ${subGameData.eventName}`);

      // Используем upsert для создания или обновления записи
      const subGame = await this.prismaService.subGame.upsert({
        where: { subEventId: gameId },
        update: subGameData,
        create: subGameData
      });

      this.logger.debug(`Sub-game ${gameId} saved/updated in database with parent data from ${parentEventId}`);
      return subGame;
    } catch (error) {
      this.logger.error(`Error saving sub-game ${gameId} to database: ${error.message}`);
      throw error;
    }
  }

  private transformSubGameToApiResponse(subGame: any) {
    return {
      status: 0,
      body: {
        id: subGame.subEventId,
        game_id: subGame.gameId,
        subGameDbId: subGame.id, // ID записи в таблице SubGame
        event_name: subGame.eventName,
        team1: subGame.team1,
        team2: subGame.team2,
        sport: subGame.sport,
        league_name: subGame.leagueName,
        status: subGame.status,
        score: subGame.score,
        start_time: Math.floor(subGame.startTime.getTime() / 1000),
        priority: subGame.priority,
        parent_event_id: subGame.parentEventId
      },
      page: ''
    };
  }

  /**
   * Принудительно обновляет подигры для указанной родительской игры
   * Очищает кэш и получает свежие данные из BetAPI
   */
  async forceRefreshSubGames(parentEventId: string) {
    try {
      this.logger.debug(`Force refreshing sub-games for parent event ${parentEventId}`);
      
      // Удаляем все кэшированные подигры для этого события
      const deletedCount = await this.prismaService.subGame.deleteMany({
        where: { parentEventId }
      });
      
      this.logger.debug(`Deleted ${deletedCount.count} cached sub-games for event ${parentEventId}`);
      
      // Получаем свежие данные из BetAPI
      const betApiService = this.moduleRef.get(BetApiService, { strict: false });
      const freshData = await betApiService.fetchSubGameData(parentEventId);
      
      if (freshData && (freshData.status === 0 || freshData.status === 1) && freshData.body) {
        this.logger.debug(`Successfully refreshed sub-games data for event ${parentEventId}`);
        return freshData;
      } else if (freshData && freshData.status === 99) {
        this.logger.debug(`No sub-games found for event ${parentEventId} after refresh`);
        return { status: 99, body: null, message: 'No sub-games found' };
      }
      
      return freshData;
    } catch (error) {
      this.logger.error(`Error force refreshing sub-games for event ${parentEventId}: ${error.message}`);
      throw error;
    }
  }

  getMarkets(eventId: string) {
    return this.marketsByGame[eventId];
  }

  groupMarkets(marketsList: MarketDto[]) {
    if (!marketsList || marketsList.length === 0) return {};

    // Обновляем каждый маркет, чтобы правильно установить поля isOpen и blocked
    const updatedMarkets = marketsList.map(market => ({
      ...market,
      isOpen: !(market as any).oc_block && market.isOpen !== false,
      blocked: (market as any).oc_block === true,
      available: !(market as any).oc_block,
      name: (market as any).oc_name || (market as any).name || market.market,
      odds: (market as any).oc_rate || (market as any).odds || market.cf,
      cf: (market as any).oc_rate || (market as any).odds || market.cf // Для совместимости
    }));

    // Группируем по названию группы из API
    const grouped = groupBy(updatedMarkets, (m) => {
      return (m as any).oc_group_name || m.basis || 'Прочее';
    });

    // Оставляем рынки внутри групп в том порядке, как они приходят с API
    // Убираем сортировку для сохранения естественного порядка

    return grouped;
  }

  async markFinished(eventId: string) {
    delete this.marketsByGame[eventId];
    
    // Инвалидируем кэш подигр для завершенной игры
    try {
      const deletedSubGames = await this.prismaService.subGame.deleteMany({
        where: { parentEventId: eventId }
      });
      
      if (deletedSubGames.count > 0) {
        this.logger.info(`Invalidated cache for ${deletedSubGames.count} sub-games of finished game ${eventId}`);
        
        // Принудительно обновляем подигры из BetAPI для получения финальных данных
        try {
          await this.forceRefreshSubGames(eventId);
          this.logger.info(`Force refreshed sub-games for finished game ${eventId}`);
        } catch (refreshError) {
          this.logger.warn(`Could not force refresh sub-games for finished game ${eventId}: ${refreshError.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Error invalidating sub-games cache for finished game ${eventId}:`, error.message);
    }
    
    const game = await this.prismaService.game.update({
      data: { status: 'FINISHED' },
      where: {
        eventId,
        status: 'IN_PROGRESS',
      },
    });
    
    this.logger.info(`Finished game: ${game.eventId} - sub-games cache invalidated and refreshed`);
    
    if (!game.score) {
      this.logger.error(`Finished game with empty score: ${game.eventId}`);
    }
  }
  async markStarting(eventId: string) {
    await this.prismaService.game.update({
      data: { status: 'STARTING' },
      where: {
        eventId,
        status: 'PREMATCH',
      },
    });
  }

  removeMarkets(eventId: string, markets: string[]) {
    if (this.marketsByGame[eventId] == null) return;
    for (const market of markets) {
      if (this.marketsByGame[eventId][market].isOpen) {
        this.marketsByGame[eventId][Opened] -= 1;
      }
      delete this.marketsByGame[eventId][market];
    }
  }

  toGameStatus(val: any): GameStatus {
    // Приводим к строке и к верхнему регистру для универсальности
    const normalized = String(val).toUpperCase();
    if (
      ['CANCELED', 'FINISHED', 'IN_PROGRESS', 'PREMATCH', 'STARTING'].includes(
        normalized,
      )
    ) {
      return normalized as GameStatus;
    }
    // Можно выбросить ошибку или вернуть дефолтное значение
    // throw new Error(`Invalid GameStatus: ${val}`);
    return 'PREMATCH';
  }

  async updateGame(eventId: string, data: Partial<Game>) {
    return this.prismaService.game.update({ data, where: { eventId } });
  }

  async updateMarkets(eventId: string, markets: MarketDto[]) {
    // Логирование для отладки
    console.log('==== UPDATE MARKETS ====');
    console.log('Event ID:', eventId);
    console.log('Markets length:', markets.length);
    if (markets.length > 0) {
      console.log('First market:', markets[0]);
      console.log('Market fields:', Object.keys(markets[0]));
    }

    const enabled = this.configService.get('BETAPI_ENABLED');
    if (enabled === 'true' || enabled === true) {
      if (this.marketsByGame[eventId] !== undefined) {
        Object.keys(this.marketsByGame[eventId]).forEach((key) => {
          if (key === String(Opened)) return;
          const m = markets.filter(
            (_) => _.market === this.marketsByGame[eventId][key].market,
          );
          if (!m.length) {
            this.marketsByGame[eventId][key].isOpen = false;
          }
        });
      }
    }

    if (this.marketsByGame[eventId] == null) {
      this.marketsByGame[eventId] = {
        [Opened]: 0,
      };
    }

    for (const value of markets) {

      const market = this.marketsByGame[eventId][value.market];
      const marketExist = market != null;
      const newMarket = value.isOpen && marketExist;
      const closingMarket = !value.isOpen && marketExist;
      const reopenMarket = marketExist && !market.isOpen && value.isOpen;

      if (newMarket || reopenMarket) {
        this.marketsByGame[eventId][Opened] += 1;
      }
      if (closingMarket) {
        this.marketsByGame[eventId][Opened] -= 1;
      }

      this.marketsByGame[eventId][value.market] = value;
    }

    // Сохраняем groupedMarkets в базу данных
    try {
      // Группируем маркеты
      const groupedMarkets = this.groupMarkets(markets);
      
      // Получаем текущую игру
      const game = await this.prismaService.game.findFirst({
        where: { eventId },
        select: { meta: true }
      });

      if (game) {
        // Обновляем meta, добавляя groupedMarkets
        const updatedMeta = {
          ...(game.meta as any || {}),
          groupedMarkets: groupedMarkets
        };

        // Сохраняем в базу данных (игра)
        await this.prismaService.game.update({
          where: { eventId },
          data: {
            meta: updatedMeta,
            updatedAt: new Date()
          }
        });

        // ИСПРАВЛЕНИЕ: Также сохраняем в таблицу GameMarkets
        await this.prismaService.gameMarkets.upsert({
          where: { eventId },
          create: {
            eventId,
            markets: markets as any
          },
          update: {
            markets: markets as any,
            updatedAt: new Date()
          }
        });

        this.logger.debug(`Updated groupedMarkets in database for eventId: ${eventId}`, {
          groupsCount: Object.keys(groupedMarkets).length,
          totalMarkets: Object.values(groupedMarkets).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0),
          groupNames: Object.keys(groupedMarkets),
          rawMarketsCount: markets.length
        });
      } else {
        this.logger.warn(`Game not found for eventId: ${eventId} when updating groupedMarkets`);
      }
    } catch (error) {
      this.logger.error(`Failed to save groupedMarkets to database for eventId: ${eventId}`, error);
    }
  }

  async updateScore(eventId: string, score: string) {
    const { score: previousScore, sport } =
      await this.prismaService.game.findFirst({
        select: { score: true, sport: true },
        where: { eventId },
      });
    await this.prismaService.game.update({
      data: {
        score,
        status: 'IN_PROGRESS',
      },
      select: { score: true },
      where: { eventId },
    });
    const parsedPreviousScore = this.betParser.parseScore(sport, previousScore);
    const parsedScore = this.betParser.parseScore(sport, score);
    const oldPeriod = parsedPreviousScore?.period;
    const period = parsedScore?.period;
    if (period && oldPeriod && period > oldPeriod) {
      this.closeMarkets(eventId, oldPeriod);
    }
    return {
      newScore: parsedScore,
      previousScore: parsedPreviousScore,
    };
  }

  determineSubcategory(sport: string, leagueName: string): string {
    if (!sport || !leagueName) {
      return '';
    }
    return determineCountryFromLeagueName(sport, leagueName);
  }

  async findManyOptimized(params: {
    where?: Prisma.GameWhereInput;
    orderBy?: Prisma.GameOrderByWithRelationInput | Prisma.GameOrderByWithRelationInput[];
    take?: number;
    skip?: number;
    includeFlagForCountries?: boolean;
  }) {
    const { where, orderBy, take, skip, includeFlagForCountries = false } = params;
    
    const subcategorySelect = includeFlagForCountries 
      ? {
          code: true,
          id: true,
          name: true,
          sport: true,
          type: true,
          flag: true
        }
      : {
          code: true,
          id: true,
          name: true,
          sport: true,
          type: true
        };

    if (take && take > 20) {
      const gameIds = await this.prismaService.game.findMany({
        where,
        orderBy,
        take,
        skip,
        select: { eventId: true }
      });
      
      if (gameIds.length === 0) {
        return [];
      }
      
      return this.prismaService.game.findMany({
        where: { 
          eventId: { in: gameIds.map(g => g.eventId) } 
        },
        include: {
          subcategory: {
            select: subcategorySelect
          }
        }
      });
    }
    
    return this.prismaService.game.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        subcategory: {
          select: subcategorySelect
        }
      }
    });
  }

  // Метод для загрузки игр, сгруппированных по подкатегориям с оптимизацией
  async findGamesBySubcategoriesOptimized(params: {
    where?: Prisma.GameWhereInput;
    take?: number;
    subcategoryType?: string;
    sport?: string;
  }) {
    const { where, take = 10, subcategoryType, sport } = params;
    
    // Создаем базовый запрос
    const baseWhere: Prisma.GameWhereInput = { 
      ...where,
      subcategory: {
        isActive: true,
        ...(sport ? { sport } : {}),
        ...(subcategoryType ? { type: subcategoryType } : {})
      }
    };
    
    // 1. Получаем список уникальных подкатегорий с количеством игр
    const subcategoriesWithCount = await this.prismaService.$queryRaw<
      Array<{ id: number; name: string; code: string; sport: string; type: string; flag: string | null; game_count: number }>
    >`
      SELECT 
        s.id, 
        s.name, 
        s.code, 
        s.sport, 
        s.type,
        CASE WHEN s.type = 'country' THEN s.flag ELSE NULL END as flag,
        COUNT(g."eventId") as game_count
      FROM 
        "Subcategory" s
      JOIN 
        "Game" g ON s.id = g."subcategoryId"
      WHERE 
        s."isActive" = true
        ${sport ? Prisma.sql`AND s.sport = ${sport}` : Prisma.empty}
        ${subcategoryType ? Prisma.sql`AND s.type = ${subcategoryType}` : Prisma.empty}
        ${where ? Prisma.sql`AND g.status = ${where.status || 'IN_PROGRESS'}` : Prisma.empty}
      GROUP BY 
        s.id, s.name, s.code, s.sport, s.type, s.flag
      HAVING 
        COUNT(g."eventId") > 0
      ORDER BY 
        game_count DESC, s.name
      LIMIT ${take * 2};
    `;
    
    // Если нет категорий с играми, возвращаем пустой массив
    if (subcategoriesWithCount.length === 0) {
      return [];
    }
    
    // Ограничиваем до запрошенного количества категорий
    const limitedSubcategories = subcategoriesWithCount.slice(0, take);
    
    // 2. Для каждой подкатегории загружаем до 10 игр
    const subcategoryIds = limitedSubcategories.map(s => s.id);
    
    const gamesWithSubcategories = await this.prismaService.game.findMany({
      where: {
        ...baseWhere,
        subcategoryId: { in: subcategoryIds }
      },
      include: {
        subcategory: true // Включаем все поля подкатегории
      },
      orderBy: [
        { subcategoryId: 'asc' },
        { createdAt: 'desc' }
      ],
      take: subcategoryIds.length * 10 // Максимум 10 игр на подкатегорию
    });
    
    // 3. Группируем игры по подкатегориям
    const result = limitedSubcategories.map(subcategory => {
      // Фильтруем игры для текущей подкатегории
      const subcategoryGames = gamesWithSubcategories.filter(
        game => game.subcategoryId === subcategory.id
      );
      
      // Для уменьшения размера ответа, отделяем игры от подкатегорий
      // и создаем новые объекты без вложенной подкатегории
      const games = subcategoryGames.map(game => {
        // Деструктурируем игру, исключая поле subcategory
        const { subcategory: _, ...gameWithoutSubcategory } = game as any;
        return gameWithoutSubcategory;
      });
      
      return {
        games: games.slice(0, 10), // Ограничиваем 10 играми на категорию
        subcategory: {
          code: subcategory.code,
          flag: subcategory.type === 'country' ? subcategory.flag : null, // Флаг только для стран
          id: subcategory.id,
          name: subcategory.name,
          sport: subcategory.sport,
          type: subcategory.type
        },
        totalGames: subcategory.game_count
      };
    });
    
    return result;
  }

  async getGameCounts(status: 'IN_PROGRESS' | 'PREMATCH' | 'STARTING') {
    const totalCount = await this.prismaService.game.count({
      where: { status }
    });

    const sportCounts = await this.prismaService.game.groupBy({
      by: ['sport'],
      where: { status },
      _count: {
        sport: true
      }
    });

    const counts = {
      total: totalCount,
      ...sportCounts.reduce((acc, { sport, _count }) => ({
        ...acc,
        [sport]: _count.sport
      }), {})
    };

    return counts;
  }

      /**
     * Удаляет live-игры (IN_PROGRESS) без ставок, которые не обновлялись более 5 минут
     */
    async deleteOldLiveGames() {
      const now = Date.now();
      // Ищем live-игры без ставок
    const liveGames = await this.prismaService.game.findMany({
      where: {
        status: 'IN_PROGRESS',
        Bet: { none: {} },
      },
      select: { eventId: true, meta: true, updatedAt: true },
    });

    const toDelete: string[] = [];

    for (const game of liveGames) {
      let startAt: number | null = null;

              try {
          const meta = game.meta as any;
          if (meta?.raw_start_at && typeof meta.raw_start_at === 'string') {
            const match = meta.raw_start_at.match(/^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
            if (match) {
              const [, day, month, hour, minute] = match;
              const currentYear = new Date().getFullYear();
              
              // Создаем дату в московском времени (UTC+3)
              const startDate = new Date(Date.UTC(currentYear, parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10) - 3, parseInt(minute, 10)));
              
              // Если дата старше текущей, уменьшаем год (видимо, для игр, начавшихся в прошлом году)
              if (startDate > new Date()) {
                startDate.setFullYear(currentYear - 1);
              }
              startAt = startDate.getTime();
            }
          }
        } catch (err) {
          this.logger.error(`Ошибка парсинга raw_start_at для игры ${game.eventId}:`, err);
        }

      const updatedAgo = now - new Date(game.updatedAt).getTime();

      // Условие удаления: игра не обновлялась более 5 минут
      const notUpdatedFor5Min = updatedAgo > 5 * 60 * 1000; // 5 минут

      if (notUpdatedFor5Min) {
        toDelete.push(game.eventId);
        this.logger.debug(`Game ${game.eventId} marked for deletion: not updated for ${Math.round(updatedAgo / (60 * 1000))} minutes`);
      }
    }

    if (toDelete.length === 0) {
      this.logger.info('Нет live-игр для удаления по raw_start_at и updatedAt');
      return { deleted: 0 };
    }

    this.logger.info(`Удаляем live-игры: ${toDelete.join(', ')}`);

    const result = await this.prismaService.game.deleteMany({
      where: { eventId: { in: toDelete } },
    });

    this.logger.info(`Удалено старых live-игр: ${result.count}`);

    return { deleted: result.count };
  }

  /**
   * Автоматический планировщик для проверки и завершения старых игр каждые 5 минут
   * ОТКЛЮЧЕНО: Теперь используется только BetAPI для определения завершения игр
   */
  // @Interval(5 * 60 * 1000) // Каждые 5 минут - ОТКЛЮЧЕНО




  /**
   * Преобразует данные из BetAPI в формат groupedMarkets
   */
  transformBetApiToGroupedMarkets(betApiData: any): any {
    const groupedMarkets = {};

    if (!betApiData || !betApiData.game_oc_list) {
      this.logger.warn('No game_oc_list found in BetAPI data');
      return groupedMarkets;
    }

    this.logger.debug(`Processing ${betApiData.game_oc_list.length} market groups from BetAPI`);
    
    // Логируем структуру первой группы для отладки
    if (betApiData.game_oc_list.length > 0) {
      const firstGroup = betApiData.game_oc_list[0];
      this.logger.debug(`First group in transformation:`, {
        group_id: firstGroup.group_id,
        group_name: firstGroup.group_name,
        oc_list_length: firstGroup.oc_list?.length,
        sample_bet: firstGroup.oc_list?.[0]
      });
    }

    try {
      betApiData.game_oc_list.forEach((group: any) => {
        if (!group.group_name || !group.oc_list || !Array.isArray(group.oc_list)) {
          return;
        }

        const groupName = group.group_name;
        const markets: any[] = [];

        // Обрабатываем каждую ставку в группе
        group.oc_list.forEach((bet: any, betIndex: number) => {
          // Логируем каждую ставку для отладки
          this.logger.debug(`Processing bet:`, {
            all_keys: Object.keys(bet),
            oc_name: bet.oc_name,
            oc_rate: bet.oc_rate,
            oc_pointer: bet.oc_pointer,
            oc_size: bet.oc_size,
            // Проверяем альтернативные названия полей
            name: bet.name,
            rate: bet.rate,
            pointer: bet.pointer,
            full_object: bet
          });
          
          // Пытаемся извлечь название и коэффициент из разных возможных полей
          const betName = bet.oc_name || bet.name || bet.title || bet.label;
          const betRate = bet.oc_rate || bet.rate || bet.odds || bet.coefficient;
          const betPointer = bet.oc_pointer || bet.pointer || bet.id;
          const betSize = bet.oc_size || bet.size || bet.handicap;
          
          if (betName && (betRate !== undefined && betRate !== null)) {
            const isBlocked = bet.oc_block === true || bet.blocked === true;
            
            // Создаем правильный oc_pointer если его нет
            let finalPointer = betPointer;
            if (!betPointer || !betPointer.includes('|')) {
              // Создаем структурированный pointer в формате gameId|groupId|outcomeId|result
              const gameId = betApiData.eventId || 'unknown';
              const groupId = group.group_id || betIndex;
              const outcomeId = betIndex;
              const result = betSize || betIndex;
              finalPointer = `${gameId}|${groupId}|${outcomeId}|${result}`;
              
              this.logger.debug(`Created structured oc_pointer for bet:`, {
                original: betPointer,
                created: finalPointer,
                betName,
                groupName
              });
            }
            
            markets.push({
              id: finalPointer,
              name: betName,
              odds: parseFloat(betRate) || 1.0,
              size: betSize || null,
              blocked: isBlocked,
              available: !isBlocked,
              isOpen: !isBlocked, // Добавляем поле isOpen для совместимости
              groupName: groupName,
              // Добавляем дополнительные поля для отладки
              oc_rate: betRate,
              oc_name: betName,
              oc_pointer: finalPointer,
              oc_block: bet.oc_block
            });
          } else {
            this.logger.warn(`Skipping bet due to missing data:`, {
              has_name: !!betName,
              has_rate: betRate !== undefined && betRate !== null,
              bet_keys: Object.keys(bet),
              extracted_name: betName,
              extracted_rate: betRate
            });
          }
        });

        if (markets.length > 0) {
          // Создаем массив для WebSocket совместимости
          const marketDataArray = markets.map(market => ({
            market: market.id,
            name: market.name,
            odds: market.odds,
            size: market.size,
            blocked: market.blocked,
            rate: market.odds, // Дублируем для совместимости
            // Добавляем дополнительные поля для совместимости
            id: market.id,
            groupName: market.groupName,
            // Добавляем поле для проверки доступности ставки
            available: !market.blocked,
            isOpen: !market.blocked, // Критически важное поле для фронтенда
            oc_block: Boolean(market.blocked), // Явно преобразуем в boolean
            oc_name: market.name,
            oc_rate: market.odds,
            oc_pointer: market.id,
            cf: market.odds // Добавляем cf для совместимости со старым кодом
          }));

          // Сохраняем как массив для WebSocket, но добавляем метаданные
          groupedMarkets[groupName] = marketDataArray;
          
          // Добавляем метаданные группы как отдельные свойства массива
          groupedMarkets[groupName].groupId = group.group_id;
          groupedMarkets[groupName].groupName = groupName;
          groupedMarkets[groupName].columns = group.columns || 1;
          groupedMarkets[groupName].markets = markets;
          groupedMarkets[groupName].marketData = marketDataArray;
        }
      });

      this.logger.debug(`Transformed BetAPI data into ${Object.keys(groupedMarkets).length} market groups`);
      return groupedMarkets;

    } catch (error) {
      this.logger.error('Error transforming BetAPI data:', error);
      return {};
    }
  }
}
