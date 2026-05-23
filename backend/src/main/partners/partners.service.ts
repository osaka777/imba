import { Injectable } from '@nestjs/common';
import {
  AffilatorType,
  BetStatus,
  OperationSource,
  OperationStatus,
  OperationType,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { OperationService } from '~/main/operation/operation.service';
import {
  PrismaService,
  PrismaTransactionClient,
} from '~/prisma/prisma.service';

@Injectable()
export class PartnersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
  ) { }

  async addBonusToPlayer(
    prisma: PrismaTransactionClient,
    user: User,
    betId: number,
    betCurrency: string,
    betAmount: Decimal,
    status: BetStatus,
  ) {
    if (user.affiliatedById == null) return;
    // Начисляем бонусы только для проигрышных ставок (стандартная практика)
    if (status !== BetStatus.LOSE) return;

    const isUserAffilator = await prisma.affilator.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (isUserAffilator) return;

    const affiliator = await prisma.affilator.findFirst({
      where: {
        userId: user.affiliatedById,
      },
    });
    if (!affiliator) return;

    // Используем процент партнера (по умолчанию 50%)
    const actualPercent = affiliator.percent;

    const bonusAmount = betAmount.times(actualPercent.dividedBy(100));

    // Проверяем, что у партнера есть баланс в нужной валюте
    const partnerBalance = await prisma.balance.findFirst({
      where: {
        userId: affiliator.userId,
        currencyCode: betCurrency,
      },
    });

    // Если у партнера нет баланса в этой валюте, создаем его с нулевым значением
    if (!partnerBalance) {
      await prisma.balance.create({
        data: {
          userId: affiliator.userId,
          currencyCode: betCurrency,
          amount: new Decimal(0),
        },
      });
    }

    // Начисляем бонус партнеру
    await this.operationService.create(prisma, affiliator.userId, {
      amount: bonusAmount,
      currencyCode: betCurrency,
      meta: {
        betId,
        affiliatorId: affiliator.userId,
        bonusType: 'affiliate_bonus',
        originalUserId: user.id,
        originalBetAmount: betAmount,
        betStatus: status,
        commissionPercent: actualPercent.toString()
      },
      source: OperationSource.AFFILIATE,
      status: OperationStatus.SUCCESS,
      type: OperationType.INCOME,
    });

  }

  // Переименовываем метод для большей ясности
  async processAffiliateBonus(
    prisma: PrismaTransactionClient,
    user: User,
    betId: number,
    betCurrency: string,
    betAmount: Decimal,
    status: BetStatus,
  ) {
    await this.addBonusToPlayer(
      prisma,
      user,
      betId,
      betCurrency,
      betAmount,
      status
    );
  }

  async connectAffiliator(user: User, tag: string | undefined) {
    if (tag == null) return;

    const affiliatedById = await this.getAffiliatorIdByTag(tag);

    if (affiliatedById != null) {
      await this.prismaService.$transaction(async (prisma) => {
        // Связываем пользователя с партнером
        await prisma.user.update({
          data: {
            affiliatedById,
          },
          where: {
            id: user.id,
          },
        });

      });
    }
  }

  async getAffiliatorIdByTag(tag: string) {
    const affiliator = await this.prismaService.affilator.findFirst({
      where: {
        uid: tag,
      },
    });
    return affiliator ? affiliator.userId : undefined;
  }

  async getAllPartners() {
    return this.prismaService.affilator.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          email: 'asc',
        },
      },
    });
  }

  async createPartner(data: {
    email: string;
    password: string;
    trafficSource: string;
    percent: number;
    affilatorsPercent?: number;
    type?: AffilatorType;
  }) {
    return this.prismaService.$transaction(async (prisma) => {
      // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: data.password, // В реальном проекте нужно хешировать пароль
        },
      });

      // Создаем партнера
      const affiliator = await prisma.affilator.create({
        data: {
          userId: user.id,
          trafficSource: data.trafficSource,
          percent: data.percent,
          affilatorsPercent: data.affilatorsPercent || 10,
          type: (data.type as AffilatorType) || AffilatorType.REVSHARE,
          meta: {},
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return affiliator;
    });
  }

  // Тестовый метод для проверки начисления бонусов
  async testPlayerBonus() {
    return this.prismaService.$transaction(async (prisma) => {
      // 1. Создаем партнера
      const affiliator = await prisma.user.create({
        data: {
          email: 'test.affiliator@test.com',
          affilator: {
            create: {
              type: 'REVSHARE',
              trafficSource: 'test_source',
              percent: new Decimal(30), // 30% бонус
            }
          }
        }
      });

      // 2. Создаем игрока и привязываем к партнеру
      const player = await prisma.user.create({
        data: {
          email: 'test.player@test.com',
          affiliatedById: affiliator.id
        }
      });

      // 3. Симулируем ставку и начисление бонуса
      const betAmount = new Decimal(100); // Ставка 100
      await this.addBonusToPlayer(
        prisma,
        player,
        1, // тестовый ID ставки
        'USD', // валюта
        betAmount,
        BetStatus.WIN
      );

      // 4. Проверяем начисление бонуса
      const operation = await prisma.operation.findFirst({
        where: {
          userId: player.id,
          source: OperationSource.AFFILIATE,
          type: OperationType.INCOME
        }
      });

      return {
        player,
        affiliator,
        bonusOperation: operation,
        expectedBonus: betAmount.times(new Decimal(30).dividedBy(100)) // Должно быть 30
      };
    });
  }

  // Тестовый метод для проверки конкретного сценария: партнер 22463, клиент 1, 4 токена с коэф 1.50, выигрыш 1000 USD
  async testSpecificScenario() {
    return this.prismaService.$transaction(async (prisma) => {

      // 1. Проверяем существование партнера (userId: 22463)
      const partner = await prisma.user.findUnique({
        where: { id: 22463 },
        include: {
          affilator: true
        }
      });

      if (!partner) {
        throw new Error('Партнер с userId 22463 не найден');
      }

      if (!partner.affilator) {
        throw new Error('Пользователь 22463 не является партнером');
      }


      // 2. Проверяем существование клиента (userId: 1)
      const client = await prisma.user.findUnique({
        where: { id: 1 }
      });

      if (!client) {
        throw new Error('Клиент с userId 1 не найден');
      }


      // 3. Проверяем, что клиент привязан к партнеру
      if (client.affiliatedById !== 22463) {
        // Привязываем клиента к партнеру
        await prisma.user.update({
          where: { id: 1 },
          data: { affiliatedById: 22463 }
        });
      }

      // 4. Создаем тестовую игру
      const testGame = await prisma.game.create({
        data: {
          eventId: `test_game_${Date.now()}`,
          eventName: 'Test Team 1 vs Test Team 2',
          leagueName: 'Test League',
          sport: 'football',
          team1: 'Test Team 1',
          team2: 'Test Team 2',
          score: '0-0',
          status: 'PREMATCH'
        }
      });


      // 5. Создаем 4 ставки (токена) с коэф 1.50, каждая на 250 USD (итого 1000 USD)
      const betAmount = new Decimal(250); // 250 USD за ставку
      const odds = new Decimal(1.50);
      const totalBetAmount = betAmount.times(4); // 1000 USD всего
      const winAmount = totalBetAmount.times(odds); // 1500 USD выигрыш

      const bets = [];
      for (let i = 1; i <= 4; i++) {
        const bet = await prisma.bet.create({
          data: {
            userId: 1, // клиент
            gameId: testGame.eventId,
            betType: `P1_${i}`, // тип ставки
            betVariant: 'ORDINAR',
            amount: betAmount,
            cf: odds,
            currencyCode: 'USD',
            status: 'PENDING'
          }
        });
        bets.push(bet);
      }

      // 6. Симулируем выигрыш всех ставок
      for (const bet of bets) {
        await prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'WIN' }
        });
      }


      // 7. Проверяем баланс клиента до начисления выигрыша
      let clientBalance = await prisma.balance.findFirst({
        where: {
          userId: 1,
          currencyCode: 'USD'
        }
      });

      if (!clientBalance) {
        clientBalance = await prisma.balance.create({
          data: {
            userId: 1,
            currencyCode: 'USD',
            amount: new Decimal(0)
          }
        });
      }

      const clientBalanceBefore = clientBalance.amount;

      // 8. Начисляем выигрыш клиенту
      await this.operationService.create(prisma, 1, {
        amount: winAmount,
        currencyCode: 'USD',
        meta: {
          title: 'Выигрыш по ставкам',
          betIds: bets.map(b => b.id),
          gameId: testGame.eventId
        },
        source: 'BET',
        status: 'SUCCESS',
        type: 'INCOME'
      });


      // 9. Проверяем баланс партнера до начисления бонуса
      let partnerBalance = await prisma.balance.findFirst({
        where: {
          userId: 22463,
          currencyCode: 'USD'
        }
      });

      if (!partnerBalance) {
        partnerBalance = await prisma.balance.create({
          data: {
            userId: 22463,
            currencyCode: 'USD',
            amount: new Decimal(0)
          }
        });
      }

      const partnerBalanceBefore = partnerBalance.amount;

      // 10. Симулируем проигрышные ставки для начисления партнерского бонуса
      // Создаем 4 проигрышные ставки по 250 USD каждая
      const losingBets = [];
      for (let i = 1; i <= 4; i++) {
        const losingBet = await prisma.bet.create({
          data: {
            userId: 1, // клиент
            gameId: testGame.eventId,
            betType: `P2_${i}`, // другой тип ставки
            betVariant: 'ORDINAR',
            amount: betAmount,
            cf: new Decimal(2.0),
            currencyCode: 'USD',
            status: 'LOSE'
          }
        });
        losingBets.push(losingBet);
      }

      // 11. Начисляем партнерские бонусы за проигрышные ставки
      for (const losingBet of losingBets) {
        await this.addBonusToPlayer(
          prisma,
          client,
          losingBet.id,
          'USD',
          betAmount,
          'LOSE'
        );
      }


      // 12. Получаем финальные балансы
      const finalClientBalance = await prisma.balance.findFirst({
        where: {
          userId: 1,
          currencyCode: 'USD'
        }
      });

      const finalPartnerBalance = await prisma.balance.findFirst({
        where: {
          userId: 22463,
          currencyCode: 'USD'
        }
      });

      // 13. Получаем операции партнера
      const partnerOperations = await prisma.operation.findMany({
        where: {
          userId: 22463,
          source: 'AFFILIATE',
          type: 'INCOME'
        },
        orderBy: { createdAt: 'desc' },
        take: 4
      });

      const totalPartnerBonus = partnerOperations.reduce((sum, op) => sum + op.amount.toNumber(), 0);

      return {
        testGame,
        bets,
        losingBets,
        clientBalanceBefore,
        clientBalanceAfter: finalClientBalance?.amount || 0,
        partnerBalanceBefore,
        partnerBalanceAfter: finalPartnerBalance?.amount || 0,
        totalBetAmount: totalBetAmount.toString(),
        winAmount: winAmount.toString(),
        totalPartnerBonus,
        partnerOperations,
        expectedPartnerBonus: totalBetAmount.times(partner.affilator.percent).dividedBy(100).toString()
      };
    });
  }
}
