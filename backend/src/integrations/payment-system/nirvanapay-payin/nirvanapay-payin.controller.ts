import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { HttpException } from '~/common/types/http-exception';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { isPaymentMethodEnabled } from '~/main/payment-settings/payment-settings.store';

import {
  NirvanaPayPayinService,
  PayinRequest,
  PayinResponse,
} from './nirvanapay-payin.service';

@ApiTags('NirvanaPay Payin')
@Controller('nirvanapay-payin')
export class NirvanaPayPayinController {
  private readonly logger = new Logger(NirvanaPayPayinController.name);

  constructor(private readonly payinService: NirvanaPayPayinService) {}

  private assertEnabled() {
    if (!isPaymentMethodEnabled('NirvanaPay')) {
      throw new BadRequestException('NirvanaPay отключён');
    }
  }

  @Post('create')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Создать заявку на пополнение через NirvanaPay (отключено)' })
  @ApiOkResponse({ description: 'Заявка на пополнение создана' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async createPayin(
    @Body() request: PayinRequest,
    @Req() req: any,
  ): Promise<PayinResponse> {
    this.assertEnabled();
    this.logger.log(`Creating payin for user ${req.user.id}`);
    
    // Автоматическое заполнение userInfo с реальным IP-адресом
    const payinRequest: PayinRequest = {
      ...request,
      userInfo: {
        id: request.userInfo?.id || req.user?.id?.toString() || 'test-user',
        email: request.userInfo?.email || '',
        userAgent: request.userInfo?.userAgent || req.headers['user-agent'] || '',
        ip: request.userInfo?.ip || req.ip || req.connection?.remoteAddress || '127.0.0.1',
        ...request.userInfo
      }
    };
    
    // Валидация запроса
    const validation = this.payinService.validatePayinRequest(payinRequest);
    if (!validation.valid) {
      this.logger.warn(`Invalid payin request: ${validation.errors.join(', ')}`);
      return {
        success: false,
        reason: validation.errors.join(', ')
      };
    }

    return await this.payinService.createPayin(payinRequest);
  }



  @Get('status')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Получить статус пополнения' })
  @ApiOkResponse({ description: 'Статус пополнения' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async getPayinStatus(
    @Query('clientID') clientID: string,
    @Query('currency') currency: 'KZT' | 'TRY' | 'UZS' = 'KZT',
    @Req() req: { user: { id: number } },
  ) {
    this.assertEnabled();
    this.logger.log(`Getting payin status for clientID: ${clientID}, currency: ${currency}`);
    return await this.payinService.getPayinStatus(clientID, currency);
  }

  @Get('balance')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Получить баланс аккаунта NirvanaPay' })
  @ApiOkResponse({ description: 'Баланс аккаунта' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async getBalance(
    @Query('currency') currency: 'KZT' | 'TRY' | 'UZS' = 'KZT',
    @Req() req: { user: { id: number } }
  ) {
    this.assertEnabled();
    this.logger.log(`Getting NirvanaPay balance for user: ${req.user.id}, currency: ${currency}`);
    return await this.payinService.getBalance(currency);
  }

  @Get('banks')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Получить список доступных банков и их лимиты' })
  @ApiOkResponse({ description: 'Список банков' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async getBankLimits(
    @Query('currency') currency: 'KZT' | 'TRY' | 'UZS' = 'KZT',
    @Req() req: { user: { id: number } }
  ) {
    this.assertEnabled();
    this.logger.log(`Getting bank limits for user: ${req.user.id}, currency: ${currency}`);
    return this.payinService.getBankLimits(currency);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Webhook для получения уведомлений от NirvanaPay' })
  @ApiOkResponse({ description: 'Уведомление обработано' })
  async handleCallback(@Query('secret') secret?: string): Promise<any> {
    const expectedSecret = process.env.NIRVANAPAY_CALLBACK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      this.logger.warn('NirvanaPay callback rejected: invalid secret');
      return { success: false, message: 'Unauthorized' };
    }

    this.logger.log('NirvanaPay callback triggered - checking pending deposits...');

    try {
      // Callback - это просто триггер, проверяем все pending депозиты
       await this.payinService.checkPendingDeposits();
      
      return {
        success: true,
        message: 'Callback processed - pending deposits checked'
      };
    } catch (error) {
      this.logger.error(`Error processing callback: ${error.message}`);
      return {
        success: true, // Возвращаем success: true чтобы NirvanaPay не повторял запросы
        message: `Callback processed with error: ${error.message}`
      };
    }
  }
}