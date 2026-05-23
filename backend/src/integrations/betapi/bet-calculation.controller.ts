import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { BetCalculationService } from './bet-calculation.service';
import { CreateBetResponseDto } from './dto/create-bet.dto';
import { BetResultsLoggerService } from './bet-results-logger.service';
import { PrismaService } from '~/prisma/prisma.service';
import { OperationService } from '~/main/operation/operation.service';
import { EventGateway } from '~/main/event/event.gateway';
import { Decimal } from '@prisma/client/runtime/library';

@ApiTags('BetAPI')
@Controller('')
export class BetCalculationController {
  private readonly logger = new Logger(BetCalculationController.name);

  constructor(
    private readonly betCalculationService: BetCalculationService,
    private readonly betResultsLogger: BetResultsLoggerService,
    private readonly prismaService: PrismaService,
    private readonly operationService: OperationService,
    private readonly eventGateway: EventGateway,
  ) {}

  @Post('bet')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать ставку' })
  @ApiResponse({ status: 201, type: CreateBetResponseDto })
  async createBet(@Body() createBetDto: any, @Req() req: any): Promise<CreateBetResponseDto> {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }
      
      const betResult = await this.betCalculationService.createUserBet(userId.toString(), createBetDto);
      return {
        success: true,
        betId: betResult.betId,
        status: betResult.status,
        potentialPayout: betResult.potentialPayout,
        coefficientChanged: betResult.coefficientChanged,
        originalCoefficient: betResult.originalCoefficient,
        actualCoefficient: betResult.actualCoefficient
      };
    } catch (error) {
      this.logger.error('Error creating bet:', error.message);
      
      // Enhanced error handling with specific error types
      if (error instanceof HttpException) {
        const errorResponse = error.getResponse();
        
        // Handle structured error responses
        if (typeof errorResponse === 'object' && errorResponse !== null) {
          const errorData = errorResponse as any;
          
          // Insufficient funds error
          if (errorData.errorCode === 1) {
            return { 
              success: false, 
              error: 'Insufficient funds',
              errorCode: 1,
              details: {
                required: errorData.required,
                available: errorData.available,
                currency: errorData.currency,
                message: 'You do not have enough balance to place this bet'
              }
            };
          }
          
          // Coefficient changed error
          if (errorData.message && errorData.message.includes('coefficient')) {
            return { 
              success: false, 
              error: 'Odds have changed',
              errorCode: 3,
              details: {
                message: 'The odds for this bet have changed since you selected it. Please refresh and try again.'
              }
            };
          }
          
          // Market closed error
          if (errorData.message && (errorData.message.includes('closed') || errorData.message.includes('suspended'))) {
            return { 
              success: false, 
              error: 'Market unavailable',
              errorCode: 2,
              details: {
                message: 'This betting market is currently closed or suspended.'
              }
            };
          }
          
          // Event not found error
          if (errorData.message && (errorData.message.includes('not found') || errorData.message.includes('cancelled'))) {
            return { 
              success: false, 
              error: 'Event unavailable',
              errorCode: 4,
              details: {
                message: 'This event is no longer available for betting.'
              }
            };
          }

          // Express bet validation error - same match different outcomes
          if (errorData.errorCode === 'error_repeat_bet_data') {
            return { 
              success: false, 
              error: 'Нельзя делать ставки из одного матча на разные исходы в экспрессе',
              errorCode: 'error_repeat_bet_data',
              details: {
                message: 'Cannot place bets from the same match on different outcomes in an express bet'
              }
            };
          }
        }
      }
      
      // Generic error fallback
      return { 
        success: false, 
        error: error.message || 'Failed to place bet',
        details: {
          message: 'An unexpected error occurred while placing your bet. Please try again.'
        }
      };
    }
  }

  /**
   * Создает ЛОКАЛЬНУЮ тестовую ставку со статусом LOSE (без обращения к BetAPI)
   * Префикс: /api
   */
  @Post('test/simulate-lose')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Симулировать проигранную ставку локально (без BetAPI)' })
  @ApiResponse({ status: 201, description: 'Создана тестовая ставка со статусом LOSE' })
  async simulateLose(
    @Body() body: { amount: number; currency: string; eventId: string; odds?: number; accountType?: 'bonus' | 'main'; forceLose?: boolean },
    @Req() req: any,
  ) {
    try {
      const userId: number = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const amount = Number(body?.amount);
      const currency = String(body?.currency || 'KZT');
      const eventId = String(body?.eventId || 'TEST');
      const odds = Number(body?.odds || 1.9);
      const accountType = body?.accountType === 'bonus' ? 'bonus' : 'main';
      const forceLose = body?.forceLose === true;

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new HttpException('Invalid amount', HttpStatus.BAD_REQUEST);
      }

      // Создаем уникальный betCode
      const betCode = `SIM-${Date.now()}-${userId}`;

      // Дебетируем средства в зависимости от типа счёта
      if (accountType !== 'bonus') {
        // Основной счет: проверяем баланс и списываем операцией OUTCOME
        const balance = await this.prismaService.balance.findUnique({
          where: { userId_currencyCode: { userId, currencyCode: currency } },
        });
        if (!balance || balance.amount.lessThan(new Decimal(amount))) {
          throw new HttpException({ message: 'Insufficient funds' }, 400);
        }
        await this.prismaService.$transaction(async (prisma) => {
          await this.operationService.create(prisma, userId, {
            type: 'OUTCOME',
            amount: new Decimal(amount),
            currencyCode: currency,
            source: 'BET',
            status: 'SUCCESS',
            meta: { description: `Симуляция ставки (LOSE) на ${eventId}`, betCode },
          });
        });
      } else {
        // Бонусный счет: проверяем активный бонус и списываем
        const bb = await this.prismaService.bonusBalance.findUnique({
          where: { userId_currencyCode: { userId, currencyCode: currency } },
        });
        if (!bb || !bb.isActive) {
          throw new HttpException({ message: 'Бонусный счёт не активен' }, 400);
        }
        if (bb.isTokenBased) {
          // Токенный бонус
          if (forceLose) {
            // Форсированно деактивируем и обнуляем жетоны без проверок
            await this.prismaService.bonusBalance.update({
              where: { userId_currencyCode: { userId, currencyCode: currency } },
              data: { isActive: false, remainingTokens: 0, updatedAt: new Date() },
            });
          } else {
            // Токенный: требуется ровно tokensPerBet и хотя бы столько жетонов
            if (bb.remainingTokens < bb.tokensPerBet) {
              throw new HttpException({ message: 'Недостаточно жетонов для ставки' }, 400);
            }
            if (amount !== Number(bb.tokensPerBet)) {
              throw new HttpException({ message: `Нужно ставить ровно ${bb.tokensPerBet} жетон(ов)` }, 400);
            }
            // На проигрыше деактивируем и обнуляем жетоны
            await this.prismaService.bonusBalance.update({
              where: { userId_currencyCode: { userId, currencyCode: currency } },
              data: { isActive: false, remainingTokens: 0, updatedAt: new Date() },
            });
          }

          // Гарантируем наличие записи в истории, если её не было
          const pendingHistoryCount = await this.prismaService.bonusHistory.count({
            where: { userId, currencyCode: currency, isTokenBased: true, status: 'PENDING' },
          });
          if (pendingHistoryCount === 0) {
            const promo = await this.prismaService.promo.upsert({
              where: { code: 'SIM-TOKEN' },
              update: {},
              create: {
                code: 'SIM-TOKEN',
                validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
                available: 1,
                type: 'VOUCHER' as any,
                value: { note: 'Synthetic promo for token simulation' },
                currencyCode: currency,
              },
            });
            await this.prismaService.bonusHistory.create({
              data: {
                userId,
                promoId: promo.id,
                promoCode: promo.code,
                promoType: 'VOUCHER' as any,
                promoValue: promo.value,
                status: 'PENDING' as any,
                totalBonusReceived: new Decimal(0),
                totalWagered: new Decimal(0),
                requiredWager: new Decimal(0),
                consecutiveWins: 0,
                requiredConsecutiveWins: 0,
                totalTokens: bb.totalTokens,
                remainingTokens: 0,
                tokensPerBet: bb.tokensPerBet,
                isTokenBased: true,
                currencyCode: currency,
                notes: 'Synthetic history created by simulation',
              },
            });
          }

          await this.prismaService.bonusHistory.updateMany({
            where: { userId, currencyCode: currency, isTokenBased: true, status: 'PENDING' },
            data: { status: 'LOSE', remainingTokens: 0, completedAt: new Date(), notes: 'Бонус завершен (симуляция проигрыша)' },
          });
        } else {
          // Денежный бонус
          if (forceLose) {
            // Форсированно обнуляем бонус и закрываем
            const dec = Decimal.min(new Decimal(amount), bb.amount);
            await this.prismaService.bonusBalance.update({
              where: { userId_currencyCode: { userId, currencyCode: currency } },
              data: {
                amount: new Decimal(0),
                totalWagered: bb.totalWagered.plus(dec),
                isActive: false,
                updatedAt: new Date(),
              },
            });

            const promo = await this.prismaService.promo.upsert({
              where: { code: 'SIM-BONUS' },
              update: {},
              create: {
                code: 'SIM-BONUS',
                validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
                available: 1,
                type: 'VOUCHER' as any,
                value: { note: 'Synthetic promo for bonus simulation' },
                currencyCode: currency,
              },
            });

            await this.prismaService.bonusHistory.create({
              data: {
                userId,
                promoId: promo.id,
                promoCode: promo.code,
                promoType: 'VOUCHER' as any,
                promoValue: promo.value,
                status: 'PENDING' as any,
                totalBonusReceived: new Decimal(0),
                totalWagered: dec,
                requiredWager: new Decimal(0),
                consecutiveWins: 0,
                requiredConsecutiveWins: 0,
                totalTokens: 0,
                remainingTokens: 0,
                tokensPerBet: 0,
                isTokenBased: false,
                currencyCode: currency,
                notes: 'Synthetic history created by simulation',
              },
            });
          }

          await this.prismaService.bonusHistory.updateMany({
            where: { userId, currencyCode: currency, isTokenBased: false, status: 'PENDING' },
            data: { status: 'LOSE', completedAt: new Date(), notes: 'Бонус завершен (симуляция проигрыша)' },
          });
        }
      }

      // Убедимся, что игра существует (FK: Bet.gameId -> Game.eventId)
      await this.prismaService.game.upsert({
        where: { eventId },
        update: { updatedAt: new Date() },
        create: {
          eventId,
          eventName: 'Test Event',
          leagueName: 'Test League',
          sport: 'TEST',
          team1: 'Team A',
          team2: 'Team B',
          score: '',
          status: 'PREMATCH' as any,
          meta: {},
        },
      });

      // Создаём ставку сразу со статусом LOSE
      const bet = await this.prismaService.bet.create({
        data: {
          userId,
          gameId: eventId,
          betType: 'SIMULATED',
          betVariant: 'ORDINAR' as any,
          amount: new Decimal(amount),
          cf: odds,
          currencyCode: accountType === 'bonus' ? currency : currency,
          status: 'LOSE' as any,
          betApiStatus: 4,
          betApiExtStatus: 0,
          betCode,
          betInfo: accountType === 'bonus' ? `SIM [TOKEN_OR_BONUS]` : `SIM`,
        },
      });

      // Отправляем WebSocket уведомление пользователю
      try {
        const notification = {
          eventId: `user_${userId}`,
          type: 'bet_status_changed',
          payload: {
            betCode,
            status: 'LOSE',
            amount: 0,
            betAmount: amount,
            currencyCode: currency,
            timestamp: new Date().toISOString()
          }
        };
        
        const sent = this.eventGateway.sendUserNotification(userId.toString(), notification as any);
        
        if (sent) {
          this.logger.log(`Simulation: Bet notification sent to user ${userId}: ${betCode} → LOSE`);
        } else {
          this.logger.warn(`Simulation: No active connections found for user ${userId} to send bet notification`);
        }
      } catch (notifError) {
        this.logger.error(`Failed to send simulation bet notification: ${notifError.message}`);
      }

      return { success: true, betId: bet.betCode || String(bet.id), status: 'LOSE' };
    } catch (error) {
      this.logger.error('Error simulating losing bet:', (error as any)?.message || error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Ошибка при симуляции ставки', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('bet/result')
  @ApiOperation({ summary: 'Получить результаты расчета ставки' })
  @ApiResponse({ status: 200, description: 'Результаты ставки обновлены' })
  async handleBetResult(
    @Body() payload: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    // Log incoming request
    this.betResultsLogger.logBetResultRequest(payload, ip, userAgent);

    try {
      await this.betCalculationService.processCallback(payload);
      
      // Log successful response
      this.betResultsLogger.logBetResultResponse(true, 'Результат ставки обработан');
      
      return { success: true, message: 'Результат ставки обработан' };
    } catch (error) {
      // Log error
      this.betResultsLogger.logBetResultError(error, 'handleBetResult');
      
      this.logger.error('Error processing bet result:', error.message);
      throw new HttpException('Ошибка при обработке результата ставки', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('bet')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить ставки пользователя' })
  async getUserBets(@Req() req: any, @Query('status') status?: string) {
    try {
      return this.betCalculationService.getUserBets(req.user.id, status);
    } catch (error) {
      throw new HttpException('Ошибка при получении ставок', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }



  @Get('status/:betId')
  async getBetStatus(@Param('betId') betId: string) {
    try {
      const result = await this.betCalculationService.getBetStatus(betId);
      return { success: true, data: result };
    } catch (error) {
      throw new HttpException('Ошибка при получении статуса ставки', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('health')
  async checkHealth() {
    try {
      const healthy = await this.betCalculationService.checkApiHealth();
      return { success: healthy, healthy, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, healthy: false, error: error.message, timestamp: new Date().toISOString() };
    }
  }

  @Post('test-bet')
  @ApiOperation({ summary: 'Создать тестовую ставку (без аутентификации)' })
  @ApiResponse({ status: 201, type: CreateBetResponseDto })
  async createTestBet(@Body() createBetDto: any): Promise<CreateBetResponseDto> {
    try {
      // Используем фиксированный userId для тестирования
      const userId = createBetDto.userId || '1';
      
      const betResult = await this.betCalculationService.createUserBet(userId.toString(), createBetDto);
      return {
        success: true,
        betId: betResult.betId,
        status: betResult.status,
        potentialPayout: betResult.potentialPayout
      };
    } catch (error) {
      this.logger.error('Error creating test bet:', error.message);
      
      // Проверяем, является ли это HttpException с errorCode
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'errorCode' in response) {
          const errorResponse = response as any;
          if (errorResponse.errorCode === 'error_repeat_bet_data') {
            return {
              success: false,
              error: errorResponse.message,
              errorCode: 'error_repeat_bet_data',
              message: 'Нельзя создать экспресс-ставку из разных событий одного матча'
            };
          }
        }
      }
      
      return { success: false, error: error.message };
    }
  }
}
