import { Controller, Post, Body, Get, UseGuards, Param, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { WithdrawalService } from './withdrawal.service';
import { CreateWithdrawalDto, QUICK_AMOUNTS, WithdrawalMethod, CardType } from './dto/create-withdrawal.dto';
import { AuthenticationGuard } from '../user/authentication/authentication.guard';
import { SuperuserGuard } from '../user/authentication/superuser.guard';
import { AdminAuditService } from '../admin/admin-audit.service';
import { Request } from 'express';

@Controller()
@ApiTags('Withdrawals')
export class WithdrawalController {
  constructor(
    private readonly withdrawalService: WithdrawalService,
    private readonly auditService: AdminAuditService,
  ) {
    console.log('WithdrawalController initialized');
  }

  private async logAdminAction(
    req: any,
    action: string,
    entityId: string | number,
    metadata?: Record<string, unknown>,
  ) {
    await this.auditService.log({
      actorRole: req?.adminRole || 'superadmin',
      actorToken: req?.adminToken,
      action,
      entityType: 'withdrawal',
      entityId,
      ip: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata: metadata || {},
    });
  }

  @Post('withdraw')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async createWithdraw(
    @Body() body: any,
    @Req() req: Request & { user: { id: number } },
  ) {
    console.log('Create withdrawal request received:', {
      body,
      wallet: body.wallet,
      walletType: typeof body.wallet,
      walletLength: body.wallet?.length,
      method: body.method,
      amount: body.amount,
      currency: body.currency
    });
    
    try {
      // Validate required fields
      if (!body.amount || !body.currency || !body.method) {
        throw new BadRequestException('Отсутствуют обязательные поля: amount, currency, method');
      }

      if (!body.wallet || body.wallet.trim() === '') {
        console.log('WALLET VALIDATION FAILED:', {
          wallet: body.wallet,
          walletTrimmed: body.wallet?.trim(),
          allBodyKeys: Object.keys(body),
          bodyStringified: JSON.stringify(body, null, 2)
        });
        throw new BadRequestException('Номер кошелька/карты обязателен');
      }

      // Map frontend data to backend DTO format
      const createDto: CreateWithdrawalDto = {
        method: this.mapMethodToWithdrawalMethod(body.method),
        cardType: this.mapMethodToCardType(body.method),
        cardNumber: body.wallet || body.cardNumber,
        amount: Number(body.amount),
        currency: body.currency,
        quickAmount: body.quickAmount,
      };
      
      console.log('Mapped DTO:', createDto);
      
      const result = await this.withdrawalService.create(req.user.id, createDto);
      console.log('Withdrawal created successfully:', result.id);
      
      return {
        success: true,
        data: result,
        message: 'Запрос на вывод успешно создан'
      };
    } catch (error) {
      console.error('Withdrawal creation failed:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Произошла ошибка при создании запроса на вывод'
      );
    }
  }

  private mapMethodToWithdrawalMethod(method: string): WithdrawalMethod {
    const cardMethods = ['card', 'cards_kz', 'cards_foreign', 'cards_ru', 'cards_ua'];
    const cryptoMethods = ['crypto', 'usdt_trc20', 'usdt_tron'];
    
    if (cardMethods.includes(method)) {
      return WithdrawalMethod.CARD;
    } else if (cryptoMethods.includes(method)) {
      return WithdrawalMethod.CRYPTO;
    }
    
    return WithdrawalMethod.CARD; // default
  }

  private mapMethodToCardType(method: string): CardType {
    const typeMap: Record<string, CardType> = {
      'cards_kz': CardType.KAZAKHSTAN,
      'cards_ru': CardType.RUSSIA,
      'cards_foreign': CardType.FOREIGN,
      'usdt_trc20': CardType.TRC20,
      'usdt_tron': CardType.TRON,
    };
    
    return typeMap[method] || CardType.FOREIGN;
  }

  private mapMethodToType(method: string): any {
    const methodMap = {
      'card': 'CARD',
      'cards_kz': 'CARD',
      'cards_foreign': 'CARD',
      'cards_ru': 'CARD',
      'cards_ua': 'CARD',
      'crypto': 'CRYPTO',
      'usdt_trc20': 'CRYPTO',
      'usdt_tron': 'CRYPTO',
      'qiwi': 'QIWI',
      'yoomoney': 'YOOMONEY',
      'NIRVANAPAY': 'NIRVANAPAY',
    };
    return methodMap[method] || 'CARD';
  }

  @Get('quick-amounts')
  @ApiOperation({ summary: 'Получить быстрые суммы для вывода' })
  @ApiOkResponse({ description: 'Список быстрых сумм' })
  async getQuickAmounts() {
    return {
      success: true,
      data: QUICK_AMOUNTS
    };
  }

  @Post('withdrawals')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать заявку на вывод средств' })
  async create(
    @Body() createDto: CreateWithdrawalDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    console.log('Create withdrawal request received:', createDto);
    const result = await this.withdrawalService.create(req.user.id, createDto);
    return {
      success: true,
      data: result,
      message: 'Заявка на вывод средств успешно создана'
    };
  }

  @Get('withdrawals')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async getUserWithdrawals(@Req() req: Request & { user: { id: number } }) {
    console.log('Get user withdrawals request received');
    return this.withdrawalService.getUserWithdrawals(req.user.id);
  }

  @Post('withdrawals/:id/cancel')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отменить свою заявку на вывод (WAITING)' })
  async cancelWithdrawal(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: number } },
  ) {
    const withdrawId = Number(id);
    if (!Number.isFinite(withdrawId) || withdrawId <= 0) {
      throw new BadRequestException('Некорректный ID заявки');
    }
    const result = await this.withdrawalService.cancelByUser(req.user.id, withdrawId);
    return {
      success: true,
      data: result,
      message: 'Заявка на вывод отменена, средства возвращены на баланс',
    };
  }

  // Admin endpoints
  @Get('admin/withdrawals')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Получить все заявки на вывод для админ-панели' })
  async getWithdrawals(@Query('filter') filter?: string) {
    console.log('Get all withdrawals request received, filter:', filter);
    const withdrawals = await this.withdrawalService.getAllWithdrawals(filter);
    
    // Форматируем данные для админ-панели с новыми полями
     return {
       success: true,
       data: withdrawals.map(withdrawal => ({
         id: withdrawal.id,
         userEmail: withdrawal.userEmail,
         amount: withdrawal.amount,
         currency: withdrawal.currency,
         method: withdrawal.method, // Метод вывода (CARD/CRYPTO)
         cardNumber: withdrawal.wallet, // Номер карты/кошелька
         status: withdrawal.status,
         createdAt: withdrawal.createdAt
       }))
     };
  }

  @Post('admin/withdrawals/:id/status')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    console.log('Update withdrawal status request received', { id, status });
    await this.withdrawalService.updateStatus(Number(id), status);
  }

  @Post('admin/withdrawals/:id/process')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async processWithdrawal(@Param('id') id: string) {
    console.log('Process withdrawal request received', { id });
    await this.withdrawalService.processWithdrawal(Number(id));
  }

  // Admin panel endpoints
  @Get('withdrawals/all')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Получить все заявки на вывод с данными пользователей' })
  async getAllWithdrawalsForAdmin() {
    console.log('Get all withdrawals for admin panel');
    const withdrawals = await this.withdrawalService.getAllWithdrawalsWithUserData();
    
    return {
       success: true,
       data: withdrawals.map(withdrawal => ({
         id: withdrawal.id,
         userId: withdrawal.userId,
         userEmail: withdrawal.userEmail,
         amount: withdrawal.amount,
         currency: withdrawal.currency,
         method: withdrawal.method === 'CARD' ? 'Карта' : withdrawal.method === 'CRYPTO' ? 'Криптовалюта' : withdrawal.method,
         cardNumber: withdrawal.cardNumber,
         cardType: withdrawal.cardType, // Добавляем поле cardType для админ-панели
         reason: withdrawal.reason, // Добавляем поле reason для отображения причины отклонения
         status: withdrawal.status,
         createdAt: withdrawal.createdAt,
         processedAt: withdrawal.processedAt
       }))
     };
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      WAITING: 'Ожидает обработки',
      PROCESSING: 'В обработке',
      SUCCESS: 'Выполнено',
      FAILED: 'Отклонено',
      pending: 'Ожидает обработки',
      processing: 'В обработке',
      completed: 'Выполнено',
      rejected: 'Отклонено',
    };
    return statusMap[status] || status;
  }

  @Post('withdrawals/:id/processing')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  @ApiOperation({ summary: 'Перевести заявку в статус «В обработке»' })
  async markProcessing(@Param('id') id: string, @Req() req: any) {
    await this.withdrawalService.updateStatus(Number(id), 'processing');
    await this.logAdminAction(req, 'withdrawal.processing', id);
    return { success: true, status: 'processing' };
  }

  @Post('withdrawals/:id/approve')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async approveWithdrawal(@Param('id') id: string, @Req() req: any) {
    console.log('Approve withdrawal request received', { id });
    const result = await this.withdrawalService.updateStatus(Number(id), 'completed');
    await this.logAdminAction(req, 'withdrawal.approve', id);
    return result;
  }

  @Post('withdrawals/:id/reject')
  @UseGuards(SuperuserGuard)
  @ApiBearerAuth('Admin')
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    console.log('Reject withdrawal request received', { id, reason });
    const result = await this.withdrawalService.updateStatus(Number(id), 'rejected', reason);
    await this.logAdminAction(req, 'withdrawal.reject', id, { reason: reason || null });
    return result;
  }
}