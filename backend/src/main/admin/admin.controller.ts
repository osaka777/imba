import { Controller, Get, Post, Body, Query, UseGuards, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminWelcomeBonusAnalyticsService } from './admin-welcome-bonus-analytics.service';
import { SuperuserGuard } from '../user/authentication/superuser.guard';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly welcomeBonusAnalytics: AdminWelcomeBonusAnalyticsService,
  ) {}

  @Get('test')
  @UseGuards(SuperuserGuard)
  async test() {
    return { message: 'Admin API is working', timestamp: new Date().toISOString() };
  }

  @Get('financial-stats')
  @UseGuards(SuperuserGuard)
  async getFinancialStatistics(@Query('period') period: string = 'day') {
    try {
      const result = await this.adminService.getFinancialStatistics(period);
      console.log('Financial stats result:', result);
      return result;
    } catch (error) {
      console.error('Error in getFinancialStatistics:', error);
      return { error: error.message, totalDeposits: 0, totalWithdrawals: 0, totalBonuses: 0, totalRevenue: 0, chartData: [] };
    }
  }

  @Get('games-stats')
  @UseGuards(SuperuserGuard)
  async getGamesStatistics(@Query('period') period: string = 'day') {
    try {
      const result = await this.adminService.getGamesStatistics(period);
      console.log('Games stats result:', result);
      return result;
    } catch (error) {
      console.error('Error in getGamesStatistics:', error);
      return { error: error.message, totalWins: 0, totalLosses: 0, totalGames: 0, chartData: [] };
    }
  }

  @Get('partners-stats')
  @UseGuards(SuperuserGuard)
  async getPartnersStatistics(@Query('period') period: string = 'day') {
    try {
      const result = await this.adminService.getPartnersStatistics(period);
      console.log('Partners stats result:', result);
      return result;
    } catch (error) {
      console.error('Error in getPartnersStatistics:', error);
      return { error: error.message, activeCount: 0, data: [] };
    }
  }

  @Get('referrals')
  @UseGuards(SuperuserGuard)
  async getReferralsOverview(@Query('limit') limit?: string) {
    try {
      return await this.adminService.getReferralsOverview(
        limit ? Number(limit) : 200,
      );
    } catch (error) {
      console.error('Error in getReferralsOverview:', error);
      return { error: error.message, total: 0, items: [] };
    }
  }

  @Get('affiliate-partners')
  @UseGuards(SuperuserGuard)
  async getAffiliatePartners(@Query('limit') limit?: string) {
    try {
      return await this.adminService.getAffiliatePartners(
        limit ? Number(limit) : 200,
      );
    } catch (error) {
      console.error('Error in getAffiliatePartners:', error);
      return { error: error.message, total: 0, items: [] };
    }
  }

  @Post('affiliate-partners/:userId/status')
  @UseGuards(SuperuserGuard)
  async updateAffiliatePartnerStatus(
    @Param('userId') userId: string,
    @Body() body: { status: 'PENDING' | 'ACTIVE' | 'BLOCKED' },
  ) {
    try {
      return await this.adminService.updateAffiliatePartnerStatus(
        Number(userId),
        body.status,
      );
    } catch (error) {
      console.error('Error in updateAffiliatePartnerStatus:', error);
      return { error: error.message };
    }
  }

  @Post('affiliate-partners/:userId/percent')
  @UseGuards(SuperuserGuard)
  async updateAffiliatePartnerPercent(
    @Param('userId') userId: string,
    @Body() body: { percent: number },
  ) {
    try {
      return await this.adminService.updateAffiliatePartnerPercent(
        Number(userId),
        body.percent,
      );
    } catch (error) {
      console.error('Error in updateAffiliatePartnerPercent:', error);
      return { error: error.message };
    }
  }

  @Get('affiliate-partners/:userId/promos')
  @UseGuards(SuperuserGuard)
  async getAffiliatePartnerPromos(@Param('userId') userId: string) {
    try {
      return await this.adminService.getAffiliatePartnerPromos(Number(userId));
    } catch (error) {
      console.error('Error in getAffiliatePartnerPromos:', error);
      return { error: error.message, items: [] };
    }
  }

  @Post('affiliate-partners/:userId/cpa')
  @UseGuards(SuperuserGuard)
  async updateAffiliatePartnerCpa(
    @Param('userId') userId: string,
    @Body() body: { cpaPayoutAmount: number; cpaCurrencyCode: string },
  ) {
    try {
      return await this.adminService.updateAffiliatePartnerCpa(
        Number(userId),
        body.cpaPayoutAmount,
        body.cpaCurrencyCode,
      );
    } catch (error) {
      console.error('Error in updateAffiliatePartnerCpa:', error);
      return { error: error.message };
    }
  }

  @Get('kick-partners')
  @UseGuards(SuperuserGuard)
  async getKickPartners(@Query('limit') limit?: string) {
    try {
      return await this.adminService.getKickPartnersOverview(
        limit ? Number(limit) : 200,
      );
    } catch (error) {
      console.error('Error in getKickPartners:', error);
      return { error: error.message, total: 0, liveCount: 0, connectedCount: 0, items: [] };
    }
  }

  @Get('kick-partners/sessions')
  @UseGuards(SuperuserGuard)
  async getRecentKickSessions(@Query('limit') limit?: string) {
    try {
      return await this.adminService.getRecentKickSessions(
        limit ? Number(limit) : 50,
      );
    } catch (error) {
      console.error('Error in getRecentKickSessions:', error);
      return { error: error.message, total: 0, items: [] };
    }
  }

  @Post('kick-partners/:userId/brand-bonus')
  @UseGuards(SuperuserGuard)
  async grantKickBrandBonus(
    @Param('userId') userId: string,
    @Body() body: { tier?: 'pro'; currency?: string },
  ) {
    try {
      return await this.adminService.grantKickBrandBonus(
        Number(userId),
        body?.tier ?? 'pro',
        body?.currency,
      );
    } catch (error) {
      console.error('Error in grantKickBrandBonus:', error);
      throw error;
    }
  }

  @Get('kick-partners/:userId/sessions')
  @UseGuards(SuperuserGuard)
  async getKickPartnerSessions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      return await this.adminService.getKickPartnerSessions(
        Number(userId),
        limit ? Number(limit) : 50,
      );
    } catch (error) {
      console.error('Error in getKickPartnerSessions:', error);
      return { error: error.message, items: [] };
    }
  }

  @Get('users-stats')
  @UseGuards(SuperuserGuard)
  async getUsersStatistics(@Query('period') period: string = 'day') {
    try {
      const result = await this.adminService.getUsersStatistics(period);
      console.log('Users stats result:', result);
      return result;
    } catch (error) {
      console.error('Error in getUsersStatistics:', error);
      return { error: error.message, totalUsers: 0, newUsers: 0, activeUsers: 0 };
    }
  }

  @Get('statistics')
  @UseGuards(SuperuserGuard)
  async getAllStatistics(@Query('period') period: string = 'day') {
    try {
      const result = await this.adminService.getAllStatistics(period);
      console.log('All stats result:', result);
      return result;
    } catch (error) {
      console.error('Error in getAllStatistics:', error);
      return { 
        error: error.message,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalBonuses: 0,
        totalWins: 0,
        totalLosses: 0,
        totalGames: 0,
        activePartners: 0,
        totalRevenue: 0,
        revenueChart: [],
        gamesChart: [],
        partnersData: []
      };
    }
  }

  // Bonus Management Endpoints
  @Get('bonuses')
  @UseGuards(SuperuserGuard)
  async getAllBonuses(@Query('status') status?: string) {
    try {
      return await this.adminService.getAllBonuses(status);
    } catch (error) {
      console.error('Error in getAllBonuses:', error);
      return { error: error.message, bonuses: [] };
    }
  }

  @Get('bonuses/expiring')
  @UseGuards(SuperuserGuard)
  async getExpiringBonuses(@Query('hours') hours?: string) {
    const withinHours = hours ? parseInt(hours, 10) : 24;
    return this.welcomeBonusAnalytics.getExpiring(
      Number.isFinite(withinHours) ? withinHours : 24,
    );
  }

  @Get('bonuses/analytics')
  @UseGuards(SuperuserGuard)
  async getWelcomeBonusAnalytics(@Query('period') period?: string) {
    try {
      return await this.welcomeBonusAnalytics.getAnalytics(period ?? 'week');
    } catch (error) {
      console.error('Error in getWelcomeBonusAnalytics:', error);
      return { error: error.message };
    }
  }

  @Post('bonuses')
  @UseGuards(SuperuserGuard)
  async createBonus(@Body() bonusData: {
    userEmail?: string;
    amount: number;
    type: string;
    description: string;
    currencyCode?: string;
  }) {
    try {
      return await this.adminService.createBonus(bonusData);
    } catch (error) {
      console.error('Error in createBonus:', error);
      return { error: error.message };
    }
  }

  @Post('bonuses/:bonusId/approve')
  @UseGuards(SuperuserGuard)
  async approveBonus(@Param('bonusId') bonusId: string) {
    try {
      return await this.adminService.updateBonusStatus(bonusId, 'approved');
    } catch (error) {
      console.error('Error in approveBonus:', error);
      return { error: error.message };
    }
  }

  @Post('bonuses/:bonusId/reject')
  @UseGuards(SuperuserGuard)
  async rejectBonus(@Param('bonusId') bonusId: string) {
    try {
      return await this.adminService.updateBonusStatus(bonusId, 'rejected');
    } catch (error) {
      console.error('Error in rejectBonus:', error);
      return { error: error.message };
    }
  }

  // Withdrawals Management Endpoints
  @Get('withdrawals/all')
  @UseGuards(SuperuserGuard)
  async getAllWithdrawals(@Query('status') status?: string) {
    try {
      return await this.adminService.getAllWithdrawals(status);
    } catch (error) {
      console.error('Error in getAllWithdrawals:', error);
      return { error: error.message, withdrawals: [] };
    }
  }

  @Post('withdrawals/:withdrawalId/approve')
  @UseGuards(SuperuserGuard)
  async approveWithdrawal(@Param('withdrawalId') withdrawalId: string) {
    try {
      return await this.adminService.updateWithdrawalStatus(withdrawalId, 'approved');
    } catch (error) {
      console.error('Error in approveWithdrawal:', error);
      return { error: error.message };
    }
  }

  @Post('withdrawals/:withdrawalId/reject')
  @UseGuards(SuperuserGuard)
  async rejectWithdrawal(@Param('withdrawalId') withdrawalId: string) {
    try {
      return await this.adminService.updateWithdrawalStatus(withdrawalId, 'rejected');
    } catch (error) {
      console.error('Error in rejectWithdrawal:', error);
      return { error: error.message };
    }
  }

  @Get('users')
  @UseGuards(SuperuserGuard)
  async getAllUsers() {
    try {
      return await this.adminService.getAllUsers();
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return { error: error.message };
    }
  }

  @Get('users/:userId')
  @UseGuards(SuperuserGuard)
  async getUserDetails(@Param('userId') userId: string) {
    try {
      return await this.adminService.getUserDetails(userId);
    } catch (error) {
      console.error('Error in getUserDetails:', error);
      return { error: error.message };
    }
  }

  // ===== Deposits management =====
  @Get('deposits')
  @UseGuards(SuperuserGuard)
  async listDeposits(@Query('status') status: 'pending' | 'approved' | 'rejected' = 'pending') {
    return this.adminService.listDeposits(status);
  }

  @Post('deposits/:id/approve')
  @UseGuards(SuperuserGuard)
  async approveDeposit(@Param('id') id: string) {
    return this.adminService.approveDeposit(Number(id));
  }

  @Post('deposits/:id/reject')
  @UseGuards(SuperuserGuard)
  async rejectDeposit(@Param('id') id: string) {
    return this.adminService.rejectDeposit(Number(id));
  }

  // ===== Promo usages management =====
  @Get('promos/:code/usages')
  @UseGuards(SuperuserGuard)
  async getPromoUsages(@Param('code') code: string) {
    return this.adminService.getPromoUsages(code);
  }

  @Post('promos/:code/grant')
  @UseGuards(SuperuserGuard)
  async grantPromoManually(
    @Param('code') code: string,
    @Body() body: { userEmail: string },
  ) {
    return this.adminService.grantPromoManually(code, body.userEmail);
  }

  @Post('promos/:code/cancel')
  @UseGuards(SuperuserGuard)
  async cancelPromoUsage(
    @Param('code') code: string,
    @Body() body: { userEmail: string },
  ) {
    return this.adminService.cancelPromoUsage(code, body.userEmail);
  }
}
