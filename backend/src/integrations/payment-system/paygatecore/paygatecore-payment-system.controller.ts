import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { HttpException } from '~/common/types/http-exception';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { PromoModalService } from '~/main/promo-modal/promo-modal.service';

import {
  PayGateCoreCreateDepositDto,
  PayGateCoreWebhookPayload,
} from './dto/paygatecore-deposit.dto';
import { PayGateCorePaymentSystemService } from './paygatecore-payment-system.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('PayGateCore')
@Controller('payment-system/paygatecore')
export class PayGateCorePaymentSystemController {
  private readonly logger = new Logger(PayGateCorePaymentSystemController.name);

  constructor(
    private readonly paygatecoreService: PayGateCorePaymentSystemService,
    private readonly promoModalService: PromoModalService,
  ) {}

  @Post('deposit')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Создать депозит PayGateCore (карта)' })
  @ApiOkResponse({ description: 'Реквизиты для перевода' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async createDeposit(
    @Body() dto: PayGateCoreCreateDepositDto,
    @Req() req: { user: { id: number } },
  ) {
    if (dto.voucher?.trim()) {
      this.promoModalService.validateVoucherForModal(
        dto.voucher.trim(),
        dto.currency,
      );
    }
    return this.paygatecoreService.createCardDeposit(Number(req.user.id), dto);
  }

  @Get('active')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Активная заявка PayGateCore (восстановление сессии)' })
  @ApiBearerAuth()
  async getActive(@Req() req: { user: { id: number } }) {
    return this.paygatecoreService.getActiveCardDeposit(Number(req.user.id));
  }

  @Get('status')
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Статус депозита PayGateCore' })
  @ApiBearerAuth()
  async getStatus(
    @Query('depositId') depositId: string,
    @Req() req: { user: { id: number } },
  ) {
    const id = Number(depositId);
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('depositId обязателен');
    }
    return this.paygatecoreService.getDepositStatus(Number(req.user.id), id);
  }

  @Post('cancel')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Отменить депозит PayGateCore' })
  @ApiBearerAuth()
  async cancel(
    @Body() body: { depositId?: number },
    @Req() req: { user: { id: number } },
  ) {
    const depositId = Number(body?.depositId);
    if (!depositId || Number.isNaN(depositId)) {
      throw new BadRequestException('depositId обязателен');
    }
    return this.paygatecoreService.cancelDeposit(Number(req.user.id), depositId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook PayGateCore' })
  async webhook(
    @Req() req: RawBodyRequest,
    @Headers('x-signature') signature: string | undefined,
    @Body() body: PayGateCoreWebhookPayload,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    const pathWithQuery = req.originalUrl.split('#')[0];

    this.logger.log(
      `PayGateCore webhook received for ${body?.merchant_transaction_id}, status=${body?.status}`,
    );

    return this.paygatecoreService.handleWebhook(
      rawBody,
      pathWithQuery,
      signature,
      body,
    );
  }
}
