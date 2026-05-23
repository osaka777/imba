import { Injectable, Inject } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Logger } from 'winston';
import { PrismaService } from '~/prisma/prisma.service';

@Injectable()
export class GameCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('winston') private readonly logger: Logger
  ) {}

  /**
   * АГРЕССИВНАЯ автоматическая очистка старых игр каждые 5 минут
   * ИСПОЛЬЗОВАНИЕ ОТКЛЮЧЕНО - автоматические задачи убраны
   */
  // @Interval(5 * 60 * 1000) // 5 минут (было 15)
  async cleanupOldGames() {
    try {
      const now = Date.now();
      
      // АГРЕССИВНАЯ ЛОГИКА: Игра считается безопасной для удаления если:
      // 1. Статус FINISHED/CANCELED
      // 2. Не обновлялась минимум 15 минут (стабильность) - было 30
      // 3. Создана минимум 30 минут назад (не свежая) - было 1 час
      // 4. Нет ставок
      
      const stabilityTime = new Date(now - 15 * 60 * 1000); // 15 минут стабильности (было 30)
      const minAgeTime = new Date(now - 30 * 60 * 1000); // минимум 30 минут жизни (было 1 час)
      
      this.logger.info('Starting AGGRESSIVE cleanup of stable finished games without bets');
      
      // Найти СТАБИЛЬНЫЕ завершенные игры БЕЗ ставок
      const gamesToDelete = await this.prisma.game.findMany({
        where: {
          status: {
            in: ['FINISHED', 'CANCELED']
          },
          // Игра не обновлялась минимум 15 минут (стабильна)
          updatedAt: {
            lt: stabilityTime
          },
          // Игра создана минимум 30 минут назад (не свежая)
          createdAt: {
            lt: minAgeTime
          },
          // Нет ставок
          Bet: {
            none: {}
          }
        },
        select: {
          eventId: true
        },
        take: 500 // Увеличили лимит для более агрессивной очистки (было 300)
      });

      this.logger.info(`Found ${gamesToDelete.length} stable finished games without bets to delete`);

      if (gamesToDelete.length > 0) {
        // Удаляем игры без ставок батчами
        const batchSize = 100; // Увеличили для более быстрой очистки (было 50)
        let totalDeleted = 0;
        
        for (let i = 0; i < gamesToDelete.length; i += batchSize) {
          const batch = gamesToDelete.slice(i, i + batchSize);
          const eventIds = batch.map(g => g.eventId);
          
          const deleteResult = await this.prisma.game.deleteMany({
            where: {
              eventId: {
                in: eventIds
              }
            }
          });
          
          totalDeleted += deleteResult.count;
          
          // Уменьшенная пауза между батчами для более быстрой очистки
          if (i + batchSize < gamesToDelete.length) {
            await new Promise(resolve => setTimeout(resolve, 100)); // было 200
          }
        }

        this.logger.info(`AGGRESSIVE cleanup: deleted ${totalDeleted} stable games in ${Math.ceil(gamesToDelete.length / batchSize)} batches`);
      }

      // ДОПОЛНИТЕЛЬНАЯ ОЧИСТКА: старые IN_PROGRESS игры без ставок
      const oldInProgressGames = await this.prisma.game.findMany({
        where: {
          status: 'IN_PROGRESS',
          // Игра не обновлялась минимум 30 минут
          updatedAt: {
            lt: new Date(now - 30 * 60 * 1000)
          },
          // Игра создана минимум 2 часа назад
          createdAt: {
            lt: new Date(now - 2 * 60 * 60 * 1000)
          },
          // Нет ставок
          Bet: {
            none: {}
          }
        },
        select: {
          eventId: true
        },
        take: 200
      });

      if (oldInProgressGames.length > 0) {
        this.logger.info(`Found ${oldInProgressGames.length} old IN_PROGRESS games without bets to finish and delete`);
        
        // Сначала помечаем как FINISHED
        const eventIds = oldInProgressGames.map(g => g.eventId);
        await this.prisma.game.updateMany({
          where: {
            eventId: {
              in: eventIds
            }
          },
          data: {
            status: 'FINISHED',
            updatedAt: new Date()
          }
        });

        // Затем удаляем их
        const deleteResult = await this.prisma.game.deleteMany({
          where: {
            eventId: {
              in: eventIds
            }
          }
        });

        this.logger.info(`AGGRESSIVE cleanup: finished and deleted ${deleteResult.count} old IN_PROGRESS games`);
      }

      // Подсчитаем сколько нестабильных игр мы оставили
      const unstableGamesCount = await this.prisma.game.count({
        where: {
          status: {
            in: ['FINISHED', 'CANCELED']
          },
          updatedAt: {
            gte: stabilityTime // Обновлялись недавно - нестабильные
          },
          Bet: {
            none: {}
          }
        }
      });

      // Подсчитаем игры со ставками
      const gamesWithBetsCount = await this.prisma.game.count({
        where: {
          status: {
            in: ['FINISHED', 'CANCELED']
          },
          Bet: {
            some: {}
          }
        }
      });

      this.logger.info(`AGGRESSIVE cleanup stats: deleted ${gamesToDelete.length} stable, skipped ${unstableGamesCount} unstable, kept ${gamesWithBetsCount} with bets`);

    } catch (error) {
      this.logger.error('Error during AGGRESSIVE game cleanup:', error);
    }
  }

  /**
   * ДОПОЛНИТЕЛЬНАЯ ОЧИСТКА: каждые 30 минут более агрессивная очистка
   * ИСПОЛЬЗОВАНИЕ ОТКЛЮЧЕНО - автоматические задачи убраны
   */
  // @Interval(30 * 60 * 1000) // 30 минут
  async aggressiveCleanup() {
    try {
      const now = Date.now();
      
      this.logger.info('Starting EXTRA AGGRESSIVE cleanup every 30 minutes');
      
      // Еще более агрессивные параметры
      const stabilityTime = new Date(now - 10 * 60 * 1000); // 10 минут стабильности
      const minAgeTime = new Date(now - 20 * 60 * 1000); // минимум 20 минут жизни
      
      // Очищаем ВСЕ старые игры без ставок
      const allOldGames = await this.prisma.game.findMany({
        where: {
          status: {
            in: ['FINISHED', 'CANCELED']
          },
          updatedAt: {
            lt: stabilityTime
          },
          createdAt: {
            lt: minAgeTime
          },
          Bet: {
            none: {}
          }
        },
        select: {
          eventId: true
        },
        take: 1000 // Большой лимит для экстра очистки
      });

      if (allOldGames.length > 0) {
        const eventIds = allOldGames.map(g => g.eventId);
        
        const deleteResult = await this.prisma.game.deleteMany({
          where: {
            eventId: {
              in: eventIds
            }
          }
        });

        this.logger.info(`EXTRA AGGRESSIVE cleanup: deleted ${deleteResult.count} old games`);
      }

      // Также очищаем старые IN_PROGRESS игры
      const oldInProgress = await this.prisma.game.findMany({
        where: {
          status: 'IN_PROGRESS',
          updatedAt: {
            lt: new Date(now - 20 * 60 * 1000) // 20 минут без обновлений
          },
          createdAt: {
            lt: new Date(now - 1 * 60 * 60 * 1000) // 1 час назад
          },
          Bet: {
            none: {}
          }
        },
        select: {
          eventId: true
        },
        take: 500
      });

      if (oldInProgress.length > 0) {
        const eventIds = oldInProgress.map(g => g.eventId);
        
        // Помечаем как FINISHED и удаляем
        await this.prisma.game.updateMany({
          where: {
            eventId: {
              in: eventIds
            }
          },
          data: {
            status: 'FINISHED',
            updatedAt: new Date()
          }
        });

        const deleteResult = await this.prisma.game.deleteMany({
          where: {
            eventId: {
              in: eventIds
            }
          }
        });

        this.logger.info(`EXTRA AGGRESSIVE cleanup: finished and deleted ${deleteResult.count} old IN_PROGRESS games`);
      }

    } catch (error) {
      this.logger.error('Error during EXTRA AGGRESSIVE cleanup:', error);
    }
  }

  /**
   * Ручная очистка с параметрами
   */
  async manualCleanup(options: {
    hoursOld?: number;
    dryRun?: boolean;
    includeStatuses?: string[];
  } = {}) {
    const {
      hoursOld = 6,
      dryRun = false,
      includeStatuses = ['FINISHED', 'CANCELED']
    } = options;

    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    this.logger.info('Starting manual game cleanup', {
      hoursOld,
      dryRun,
      includeStatuses,
      cutoffTime
    });

    // Найти игры для анализа
    const candidates = await this.prisma.game.findMany({
      where: {
        status: {
          in: includeStatuses as any[]
        },
        updatedAt: {
          lt: cutoffTime
        }
      },
      include: {
        Bet: {
          select: { 
            id: true,
            status: true,
            amount: true,
            currencyCode: true
          }
        }
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    const analysis = {
      totalGames: candidates.length,
      gamesWithoutBets: 0,
      gamesWithBets: 0,
      totalBetsOnGames: 0,
      gamesByStatus: {} as Record<string, number>,
      wouldDelete: [] as string[],
      wouldKeep: [] as Array<{eventId: string, betCount: number, totalAmount: number}>
    };

    for (const game of candidates) {
      // Статистика по статусам
      analysis.gamesByStatus[game.status] = (analysis.gamesByStatus[game.status] || 0) + 1;

      if (game.Bet.length === 0) {
        analysis.gamesWithoutBets++;
        analysis.wouldDelete.push(game.eventId);
      } else {
        analysis.gamesWithBets++;
        analysis.totalBetsOnGames += game.Bet.length;
        
        const totalAmount = game.Bet.reduce((sum, bet) => {
          return sum + parseFloat(bet.amount.toString());
        }, 0);

        analysis.wouldKeep.push({
          eventId: game.eventId,
          betCount: game.Bet.length,
          totalAmount: Math.round(totalAmount * 100) / 100
        });
      }
    }

    this.logger.info('Cleanup analysis completed', analysis);

    if (!dryRun && analysis.wouldDelete.length > 0) {
      const deleteResult = await this.prisma.game.deleteMany({
        where: {
          eventId: {
            in: analysis.wouldDelete
          }
        }
      });

      this.logger.info(`Actually deleted ${deleteResult.count} games`);
      return { ...analysis, actuallyDeleted: deleteResult.count };
    }

    return analysis;
  }

  /**
   * Получить статистику игр
   */
  async getGameStats() {
    const [
      totalGames,
      finishedGames,
      canceledGames,
      inProgressGames,
      prematchGames,
      gamesWithBets,
      gamesWithoutBets
    ] = await Promise.all([
      this.prisma.game.count(),
      this.prisma.game.count({ where: { status: 'FINISHED' } }),
      this.prisma.game.count({ where: { status: 'CANCELED' } }),
      this.prisma.game.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.game.count({ where: { status: 'PREMATCH' } }),
      this.prisma.game.count({
        where: {
          Bet: {
            some: {}
          }
        }
      }),
      this.prisma.game.count({
        where: {
          Bet: {
            none: {}
          }
        }
      })
    ]);

    return {
      totalGames,
      byStatus: {
        FINISHED: finishedGames,
        CANCELED: canceledGames,
        IN_PROGRESS: inProgressGames,
        PREMATCH: prematchGames
      },
      withBets: gamesWithBets,
      withoutBets: gamesWithoutBets
    };
  }
} 