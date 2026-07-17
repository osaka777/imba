import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { BonusBalanceService } from './bonus-balance.service';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { SuperuserGuard } from '~/main/user/authentication/superuser.guard';

@Controller('bonus-balance')
export class BonusBalanceController {
  constructor(private readonly bonusBalanceService: BonusBalanceService) {}

  private resolveUserId(req: { user: { id: number } }, requestedUserId?: number): number {
    const currentUserId = Number(req.user.id);
    if (requestedUserId != null && Number(requestedUserId) !== currentUserId) {
      throw new ForbiddenException('Access denied');
    }
    return currentUserId;
  }

  /**
   * Получает статистику бонусных счетов партнера (для админа)
   */
  @Get('partner/:partnerId/stats')
  @UseGuards(SuperuserGuard)
  async getPartnerBonusStats(@Param('partnerId') partnerId: string) {
    return this.bonusBalanceService.getPartnerBonusStats(partnerId);
  }

  /**
   * Получает статистику бонусных счетов пользователей партнера (для админа)
   */
  @Get('partner/:partnerId/users')
  @UseGuards(SuperuserGuard)
  async getPartnerUsersBonusStats(@Param('partnerId') partnerId: string) {
    return this.bonusBalanceService.getPartnerUsersBonusStats(partnerId);
  }

  /**
   * Получает всех пользователей с бонусными счетами (для админа)
   */
  @Get('users')
  @UseGuards(SuperuserGuard)
  async getAllUsersWithBonusBalances() {
    return this.bonusBalanceService.getAllUsersWithBonusBalances();
  }

  @Get('expiring')
  @UseGuards(SuperuserGuard)
  async getExpiringBonuses(@Query('hours') hours?: string) {
    const withinHours = hours ? parseInt(hours, 10) : 24;
    return this.bonusBalanceService.getExpiringBonuses(
      Number.isFinite(withinHours) ? withinHours : 24,
    );
  }

  /**
   * Получает информацию о бонусном счете пользователя
   */
  @Get('user/:userId/:currencyCode')
  @UseGuards(AuthenticationGuard)
  async getUserBonusBalance(
    @Param('userId') userId: string,
    @Param('currencyCode') currencyCode: string,
    @Req() req: { user: { id: number } },
  ) {
    const uid = this.resolveUserId(req, parseInt(userId, 10));
    return this.bonusBalanceService.getUserBonusBalance(uid, currencyCode);
  }

  /**
   * Получает все бонусные балансы пользователя
   */
  @Get('user')
  @UseGuards(AuthenticationGuard)
  async getUserBonusBalances(@Query('userId') userId: string, @Req() req: { user: { id: number } }) {
    const uid = this.resolveUserId(req, userId ? parseInt(userId, 10) : undefined);
    return this.bonusBalanceService.getUserBonusBalances(uid);
  }

  /**
   * Создает бонусный счет для пользователя
   */
  @Post('create')
  @UseGuards(AuthenticationGuard)
  async createBonusAccount(
    @Body() data: {
      userId?: number;
      bonusAmount?: number;
      currencyCode: string;
    },
    @Req() req: { user: { id: number } },
  ) {
    const uid = this.resolveUserId(req, data.userId);
    return this.bonusBalanceService.createBonusAccount(uid, data.currencyCode);
  }

  /**
   * Проверяет возможность вывода бонусных средств
   */
  @Post('check-withdrawal')
  @UseGuards(AuthenticationGuard)
  async checkWithdrawalEligibility(
    @Body() data: {
      userId?: number;
      currencyCode: string;
      amount: number;
    },
    @Req() req: { user: { id: number } },
  ) {
    const uid = this.resolveUserId(req, data.userId);
    return this.bonusBalanceService.checkWithdrawalEligibility(
      uid,
      data.currencyCode,
      data.amount,
    );
  }

  /**
   * Обрабатывает ставку с бонусного счета
   */
  @Post('process-bet')
  @UseGuards(AuthenticationGuard)
  async processBonusBet(
    @Body() data: {
      userId?: number;
      currencyCode: string;
      betAmount: number;
      odds: number;
    },
    @Req() req: { user: { id: number } },
  ) {
    const uid = this.resolveUserId(req, data.userId);
    return this.bonusBalanceService.processBonusBet(
      uid,
      data.currencyCode,
      data.betAmount,
      data.odds,
    );
  }

  /**
   * Обрабатывает выигрыш по бонусной ставке
   */
  @Post('process-win')
  @UseGuards(AuthenticationGuard)
  async processBonusWin(
    @Body() data: {
      userId?: number;
      currencyCode: string;
      winAmount: number;
      originalBetAmount: number;
    },
    @Req() req: { user: { id: number } },
  ) {
    const uid = this.resolveUserId(req, data.userId);
    return this.bonusBalanceService.processBonusWin(
      uid,
      data.currencyCode,
      data.winAmount,
      data.originalBetAmount,
    );
  }

  /**
   * Получает историю бонусов пользователя
   */
  @Get('history')
  @UseGuards(AuthenticationGuard)
  async getBonusHistory(@Req() req: any) {
    return this.bonusBalanceService.getBonusHistory(req.user.id);
  }

  /**
   * Получает статистику по бонусам пользователя
   */
  @Get('history/stats')
  @UseGuards(AuthenticationGuard)
  async getBonusHistoryStats(@Req() req: any) {
    return this.bonusBalanceService.getBonusHistoryStats(req.user.id);
  }
}
