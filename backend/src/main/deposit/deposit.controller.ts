import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Inject,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  ForbiddenException,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';

import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Logger as WinstonLogger } from 'winston';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '~/prisma/prisma.service';

import { HttpException } from '~/common/types/http-exception';
import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { DepositService } from './deposit.service';
import { PromoModalService } from '../promo-modal/promo-modal.service';
import { loadPromoModalSettings } from '../promo-modal/promo-modal.store';
import { getManualDepositConfig, ManualDepositCurrency } from './manual-deposit-config.store';
import { calculateBrlFromRub } from './rub-brl.util';
import {
  MANUAL_FOREIGN_CARD_METHODS,
  ManualForeignCardPaymentSystem,
  getManualDepositKeyForMethod,
} from './manual-deposit.types';
import {
  isManualDepositEnabled,
  isPaymentMethodEnabled,
  loadPaymentSettings,
} from '../payment-settings/payment-settings.store';
import {
  createUniquePublicOrderId,
  ensurePublicOrderId,
} from './deposit-public-order-id.util';
import { createUniquePayAmount } from './usdt-trc20.util';

@ApiTags('Deposits')
@Controller('deposit')
export class DepositController {
  private readonly logger = new Logger(DepositController.name);

  constructor(
    private readonly depositService: DepositService,
    private readonly prisma: PrismaService,
    private readonly promoModalService: PromoModalService,
    @Inject('winston') private readonly winstonLogger: WinstonLogger,
  ) {}

  @Post()
  @UseGuards(AuthenticationGuard)
  @ApiOperation({ summary: 'Создать депозит' })
  @ApiOkResponse({ description: 'Депозит создан' })
  @ApiUnauthorizedResponse({ type: HttpException })
  @ApiBearerAuth()
  async createDeposit(
    @Body() createDepositDto: CreateDepositDto,
    @Req() req: any,
  ) {
    this.winstonLogger.info('===== DEPOSIT REQUEST RECEIVED (WINSTON VERSION) =====', { context: 'DepositController' });
    this.winstonLogger.info(`URL: ${req.url}`, { context: 'DepositController' });
    this.winstonLogger.info(`Method: ${req.method}`, { context: 'DepositController' });
    this.winstonLogger.info(`Body: ${JSON.stringify(createDepositDto)}`, { context: 'DepositController' });
    this.logger.log(`Creating deposit for user ${req.user.id}, currency: ${createDepositDto.currency}`);

    // NirvanaPay отключён — автоматические redirect-депозиты через POST /deposit больше не создаются.
    // Используйте manual-foreign-card / USDT / другие активные методы.
    this.logger.warn(
      `Automatic deposit endpoint disabled (NirvanaPay off). currency=${createDepositDto.currency}`,
    );
    throw new BadRequestException(
      'Этот способ пополнения больше недоступен. Выберите другой метод в кассе.',
    );
  }


  // ===== Manual foreign card payment module =====

  @Get('manual-deposit/config')
  @UseGuards(AuthenticationGuard)
  async getManualDepositConfigEndpoint(@Query('currency') currency: string) {
    const code = String(currency || 'KZT').toUpperCase();
    if (
      code !== 'KZT' &&
      code !== 'KZT_KASPI' &&
      code !== 'RUB' &&
      code !== 'RUB_SBERBANK' &&
      code !== 'RUB_YANDEX_BANK' &&
      code !== 'RUB_VTB_BANK'
    ) {
      throw new BadRequestException('Unsupported currency');
    }
    return getManualDepositConfig(code as ManualDepositCurrency);
  }

  @Post('manual-foreign-card/init')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  async initManualForeignCardOrder(
    @Req() req: any,
    @Body()
    body: {
      amount?: number | string;
      currency?: string;
      method?: ManualForeignCardPaymentSystem;
      source?: string;
      voucher?: string;
    },
  ) {
    const userId = Number(req.user.id);
    const method = String(body?.method || 'KZT_FOREIGN_CARD').toUpperCase();
    if (!MANUAL_FOREIGN_CARD_METHODS.includes(method as ManualForeignCardPaymentSystem)) {
      throw new BadRequestException('Unsupported manual method');
    }
    const currency = String(
      body?.currency ||
        (method === 'RUB_FOREIGN_CARD' ||
        method === 'RUB_SBERBANK' ||
        method === 'RUB_YANDEX_BANK' ||
        method === 'RUB_VTB_BANK'
          ? 'RUB'
          : 'KZT'),
    ).toUpperCase();
    const voucherInput = String(body?.voucher ?? '').trim() || undefined;
    if (voucherInput) {
      this.promoModalService.validateVoucherForModal(voucherInput, currency);
      await this.promoModalService.assertPromoAvailable(userId, voucherInput);
    }
    const configKey = getManualDepositKeyForMethod(method as ManualForeignCardPaymentSystem);
    if (!isManualDepositEnabled(configKey)) {
      throw new BadRequestException('Этот способ пополнения временно недоступен');
    }
    const methodKey = method as ManualForeignCardPaymentSystem;
    if (!isPaymentMethodEnabled(methodKey as any)) {
      throw new BadRequestException('Этот способ пополнения временно недоступен');
    }
    const config = getManualDepositConfig(configKey);
    const amountNum = parseFloat(String(body?.amount ?? '').replace(',', '.'));
    if (!amountNum || Number.isNaN(amountNum)) {
      throw new BadRequestException('Укажите сумму пополнения');
    }
    if (amountNum < config.minAmount) {
      throw new BadRequestException(
        `Минимальная сумма пополнения — ${config.minAmount} ${currency}`,
      );
    }
    if (methodKey === 'RUB_VTB_BANK' && amountNum > 40_000) {
      throw new BadRequestException(
        'Максимальная сумма пополнения через ВТБ — 40 000 ₽',
      );
    }

    const settings = loadPromoModalSettings();
    if (
      voucherInput &&
      voucherInput.toUpperCase() === settings.promoCode.trim().toUpperCase() &&
      amountNum < settings.minDepositAmount &&
      currency.toUpperCase() === settings.minDepositCurrency.toUpperCase()
    ) {
      throw new BadRequestException(
        `Для акции минимальное пополнение — ${settings.minDepositAmount} ${currency}`,
      );
    }

    const existing = await this.prisma.deposit.findFirst({
      where: {
        userId,
        paymentSystem: method as any,
        status: { in: ['PENDING', 'PROCESSING'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const publicOrderId = await ensurePublicOrderId(this.prisma, existing);
      const existingMeta = (existing.meta as any) || {};
      return {
        ok: true,
        order: {
          id: existing.id,
          publicOrderId,
          amount: Number(existing.amount),
          currency: existing.currencyCode,
          method: existing.paymentSystem,
          status: existing.status === 'PENDING' ? 'pending' : 'processing',
          createdAt: existing.createdAt,
          meta: existing.meta,
          brlAmount: existingMeta.brlAmount,
          rubPerBrl: existingMeta.rubPerBrl,
        },
      };
    }

    const publicOrderId = await createUniquePublicOrderId(this.prisma);
    const orderMeta: Record<string, unknown> = {
      lifecycle: 'INITIATED',
      initiatedSource: body?.source || 'manual-modal',
      initiatedAt: new Date().toISOString(),
      expiresInMinutes: 15,
      publicOrderId,
    };
    if (methodKey === 'RUB_SBERBANK' && config.rubPerBrl) {
      orderMeta.rubPerBrl = config.rubPerBrl;
      orderMeta.brlAmount = calculateBrlFromRub(amountNum, config.rubPerBrl);
    }
    if (voucherInput) {
      orderMeta.voucher = voucherInput;
    }
    const created = await this.prisma.deposit.create({
      data: {
        userId,
        externalId: `${method.toLowerCase()}_init_${Date.now()}_${userId}`,
        paymentSystem: method as any,
        amount: new Decimal(amountNum),
        currencyCode: currency,
        status: 'PENDING' as any,
        meta: orderMeta as any,
      },
    });

    return {
      ok: true,
      order: {
        id: created.id,
        publicOrderId,
        amount: Number(created.amount),
        currency: created.currencyCode,
        method: created.paymentSystem,
        status: 'pending',
        createdAt: created.createdAt,
      },
    };
  }

  @Post('manual-foreign-card/cancel')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  async cancelManualForeignCardOrder(
    @Req() req: any,
    @Body()
    body: {
      orderId?: number | string;
      method?: ManualForeignCardPaymentSystem;
    },
  ) {
    const userId = Number(req.user.id);
    const orderId = body?.orderId ? Number(body.orderId) : undefined;
    const method = body?.method ? String(body.method).toUpperCase() : undefined;

    if (orderId && Number.isNaN(orderId)) {
      throw new BadRequestException('Некорректный ID заявки');
    }
    if (method && !MANUAL_FOREIGN_CARD_METHODS.includes(method as ManualForeignCardPaymentSystem)) {
      throw new BadRequestException('Unsupported manual method');
    }

    const where: any = {
      userId,
      paymentSystem: { in: MANUAL_FOREIGN_CARD_METHODS as any },
      status: { in: ['PENDING', 'PROCESSING'] as any },
    };
    if (orderId) where.id = orderId;
    if (method) where.paymentSystem = method;

    const depo = await this.prisma.deposit.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!depo) {
      return { ok: true, cancelled: false };
    }

    const oldMeta = (depo.meta as any) || {};
    await this.prisma.deposit.update({
      where: { id: depo.id },
      data: {
        status: 'CANCELLED' as any,
        meta: {
          ...oldMeta,
          userCancelled: true,
          lifecycle: 'CANCELLED_BY_USER',
          cancelledAt: new Date().toISOString(),
          cancelReason: 'Отменено пользователем',
        } as any,
      },
    });

    return { ok: true, cancelled: true, orderId: depo.id };
  }

  @Get('manual-foreign-card/history')
  @UseGuards(AuthenticationGuard)
  async getManualForeignCardHistory(@Req() req: any) {
    const userId = Number(req.user.id);
    const rows = await this.prisma.deposit.findMany({
      where: {
        userId,
        paymentSystem: { in: MANUAL_FOREIGN_CARD_METHODS as any },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const items = await Promise.all(
      rows.map(async (depo) => {
        const isExpired =
          depo.status === ('CANCELLED' as any) &&
          (((depo.meta as any)?.autoCancelled ||
            (depo.meta as any)?.lifecycle === 'EXPIRED'));
        const status =
          isExpired
            ? 'expired'
            : depo.status === 'PENDING'
              ? 'pending'
              : depo.status === ('PROCESSING' as any)
                ? 'processing'
                : depo.status === ('FAILED' as any)
                  ? 'rejected'
                  : 'approved';
        const publicOrderId = await ensurePublicOrderId(this.prisma, depo);
        return {
          id: depo.id,
          publicOrderId,
          amount: Number(depo.amount),
          currency: depo.currencyCode,
          method: depo.paymentSystem,
          status,
          createdAt: depo.createdAt,
          reason:
            status === 'expired'
              ? ((depo.meta as any)?.autoCancelledReason ||
                  'Срок действия заявки истек')
              : ((depo.meta as any)?.rejectReason as string | undefined),
          canRetry: status === 'expired' || status === 'rejected',
        };
      }),
    );

    return { items };
  }

  @Post('kzt-foreign-card')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadKztForeignCard(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'KZT_FOREIGN_CARD',
      defaultCurrency: 'KZT',
      minAmount: getManualDepositConfig('KZT').minAmount,
      externalPrefix: 'kzt_rcpt',
    });
  }

  @Get('kzt-foreign-card/me')
  @UseGuards(AuthenticationGuard)
  async getMyKztForeignCard(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'KZT_FOREIGN_CARD');
  }

  @Post('kzt-kaspi')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadKztKaspi(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'KZT_KASPI',
      defaultCurrency: 'KZT',
      minAmount: getManualDepositConfig('KZT_KASPI').minAmount,
      externalPrefix: 'kzt_kaspi_rcpt',
    });
  }

  @Get('kzt-kaspi/me')
  @UseGuards(AuthenticationGuard)
  async getMyKztKaspi(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'KZT_KASPI');
  }

  @Post('rub-foreign-card')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadRubForeignCard(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'RUB_FOREIGN_CARD',
      defaultCurrency: 'RUB',
      minAmount: 2000,
      externalPrefix: 'rub_rcpt',
    });
  }

  @Get('rub-foreign-card/me')
  @UseGuards(AuthenticationGuard)
  async getMyRubForeignCard(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'RUB_FOREIGN_CARD');
  }

  @Post('rub-sberbank')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadRubSberbank(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'RUB_SBERBANK',
      defaultCurrency: 'RUB',
      minAmount: getManualDepositConfig('RUB_SBERBANK').minAmount,
      externalPrefix: 'rub_sberbank_rcpt',
    });
  }

  @Get('rub-sberbank/me')
  @UseGuards(AuthenticationGuard)
  async getMyRubSberbank(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'RUB_SBERBANK');
  }

  @Post('rub-yandex-bank')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadRubYandexBank(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'RUB_YANDEX_BANK',
      defaultCurrency: 'RUB',
      minAmount: getManualDepositConfig('RUB_YANDEX_BANK').minAmount,
      externalPrefix: 'rub_yandex_bank_rcpt',
    });
  }

  @Get('rub-yandex-bank/me')
  @UseGuards(AuthenticationGuard)
  async getMyRubYandexBank(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'RUB_YANDEX_BANK');
  }

  @Post('rub-vtb-bank')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const dir = join(process.cwd(), 'uploads', 'receipts');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (req, file, cb) => {
            const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
            const safeExt = extname(file.originalname || '')
              .replace(/[^a-zA-Z0-9.]/g, '')
              .slice(0, 10);
            cb(null, `${unique}${safeExt || '.jpg'}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const ok = (file.mimetype || '').startsWith('image/');
          cb(null, ok);
        },
      },
    ),
  )
  async uploadRubVtbBank(
    @Req() req: any,
    @UploadedFiles()
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: any,
  ) {
    return this.handleManualForeignCardUpload(req, res, files, {
      paymentSystem: 'RUB_VTB_BANK',
      defaultCurrency: 'RUB',
      minAmount: getManualDepositConfig('RUB_VTB_BANK').minAmount,
      externalPrefix: 'rub_vtb_bank_rcpt',
    });
  }

  @Get('rub-vtb-bank/me')
  @UseGuards(AuthenticationGuard)
  async getMyRubVtbBank(@Req() req: any) {
    return this.getMyManualForeignCard(req, 'RUB_VTB_BANK');
  }

  @Get('usdt-trc20/config')
  @UseGuards(AuthenticationGuard)
  async getUsdtTrc20Config() {
    if (!isManualDepositEnabled('USDT')) {
      throw new BadRequestException('USDT пополнение временно недоступно');
    }
    if (!isPaymentMethodEnabled('USDT_TRC20')) {
      throw new BadRequestException('USDT пополнение временно недоступно');
    }
    const config = getManualDepositConfig('USDT');
    return {
      walletAddress: config.walletAddress || config.cardNumber,
      network: 'TRC-20',
      token: 'USDT',
      minAmount: config.minAmount,
      qrImageUrl: config.qrImageUrl,
    };
  }

  @Post('usdt-trc20/init')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  async initUsdtTrc20Order(
    @Req() req: any,
    @Body() body: { amount?: number | string; source?: string },
  ) {
    const userId = Number(req.user.id);
    if (!isManualDepositEnabled('USDT')) {
      throw new BadRequestException('USDT пополнение временно недоступно');
    }
    if (!isPaymentMethodEnabled('USDT_TRC20')) {
      throw new BadRequestException('USDT пополнение временно недоступно');
    }
    const config = getManualDepositConfig('USDT');
    const walletAddress = config.walletAddress || config.cardNumber;
    if (!walletAddress) {
      throw new BadRequestException('USDT кошелёк не настроен');
    }

    const amountNum = parseFloat(String(body?.amount ?? '').replace(',', '.'));
    if (!amountNum || Number.isNaN(amountNum)) {
      throw new BadRequestException('Укажите сумму пополнения');
    }
    if (amountNum < config.minAmount) {
      throw new BadRequestException(
        `Минимальная сумма пополнения — ${config.minAmount} USDT`,
      );
    }

    const existing = await this.prisma.deposit.findFirst({
      where: {
        userId,
        paymentSystem: 'USDT_TRC20',
        status: { in: ['PENDING', 'PROCESSING'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const publicOrderId = await ensurePublicOrderId(this.prisma, existing);
      const existingMeta = (existing.meta as any) || {};
      return {
        ok: true,
        order: {
          id: existing.id,
          publicOrderId,
          amount: Number(existing.amount),
          payAmount: existingMeta.payAmount,
          walletAddress: existingMeta.walletAddress,
          network: 'TRC-20',
          currency: 'USDT',
          method: 'USDT_TRC20',
          status: existing.status === 'PENDING' ? 'pending' : 'processing',
          createdAt: existing.createdAt,
        },
      };
    }

    const payAmount = await createUniquePayAmount(this.prisma, amountNum);
    const publicOrderId = await createUniquePublicOrderId(this.prisma);
    const orderMeta = {
      lifecycle: 'INITIATED',
      initiatedSource: body?.source || 'deposit-modal',
      initiatedAt: new Date().toISOString(),
      expiresInMinutes: 45,
      publicOrderId,
      payAmount,
      walletAddress,
      network: 'TRC-20',
      token: 'USDT',
    };

    const created = await this.prisma.deposit.create({
      data: {
        userId,
        externalId: `usdt_trc20_init_${Date.now()}_${userId}`,
        paymentSystem: 'USDT_TRC20',
        amount: new Decimal(amountNum),
        currencyCode: 'USDT',
        status: 'PENDING' as any,
        meta: orderMeta as any,
      },
    });

    return {
      ok: true,
      order: {
        id: created.id,
        publicOrderId,
        amount: amountNum,
        payAmount,
        walletAddress,
        network: 'TRC-20',
        currency: 'USDT',
        method: 'USDT_TRC20',
        status: 'pending',
        createdAt: created.createdAt,
      },
    };
  }

  @Get('usdt-trc20/me')
  @UseGuards(AuthenticationGuard)
  async getMyUsdtTrc20(@Req() req: any) {
    const depo = await this.prisma.deposit.findFirst({
      where: {
        userId: Number(req.user.id),
        paymentSystem: 'USDT_TRC20',
        status: { in: ['PENDING', 'PROCESSING'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!depo) return {};
    const meta = (depo.meta as any) || {};
    const publicOrderId = await ensurePublicOrderId(this.prisma, depo);
    const isExpired =
      depo.status === ('CANCELLED' as any) &&
      (meta.autoCancelled || meta.lifecycle === 'EXPIRED');
    return {
      id: depo.id,
      publicOrderId,
      amount: Number(depo.amount),
      payAmount: meta.payAmount,
      walletAddress: meta.walletAddress,
      network: meta.network || 'TRC-20',
      currency: 'USDT',
      method: 'USDT_TRC20',
      status: isExpired
        ? 'expired'
        : depo.status === 'PENDING'
          ? 'pending'
          : 'processing',
      createdAt: depo.createdAt,
    };
  }

  @Get('usdt-trc20/order/:id')
  @UseGuards(AuthenticationGuard)
  async getUsdtTrc20OrderStatus(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const depo = await this.prisma.deposit.findFirst({
      where: {
        id,
        userId: Number(req.user.id),
        paymentSystem: 'USDT_TRC20',
      },
    });
    if (!depo) throw new NotFoundException('Заявка не найдена');
    const meta = (depo.meta as any) || {};
    const publicOrderId = await ensurePublicOrderId(this.prisma, depo);
    return {
      id: depo.id,
      publicOrderId,
      amount: Number(depo.amount),
      payAmount: meta.payAmount,
      walletAddress: meta.walletAddress,
      network: meta.network || 'TRC-20',
      currency: 'USDT',
      status:
        depo.status === 'SUCCESS'
          ? 'approved'
          : depo.status === 'CANCELLED'
            ? meta.lifecycle === 'EXPIRED'
              ? 'expired'
              : 'cancelled'
            : depo.status === 'PENDING'
              ? 'pending'
              : 'processing',
      txHash: meta.txHash,
      createdAt: depo.createdAt,
    };
  }

  @Post('usdt-trc20/cancel')
  @UseGuards(AuthenticationGuard)
  @HttpCode(200)
  async cancelUsdtTrc20(@Req() req: any, @Body() body: { orderId?: number }) {
    const userId = Number(req.user.id);
    const where: any = {
      userId,
      paymentSystem: 'USDT_TRC20',
      status: { in: ['PENDING', 'PROCESSING'] as any },
    };
    if (body?.orderId) where.id = Number(body.orderId);

    const depo = await this.prisma.deposit.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
    if (!depo) return { ok: true, cancelled: false };

    const oldMeta = (depo.meta as any) || {};
    await this.prisma.deposit.update({
      where: { id: depo.id },
      data: {
        status: 'CANCELLED' as any,
        meta: {
          ...oldMeta,
          userCancelled: true,
          lifecycle: 'CANCELLED_BY_USER',
          cancelledAt: new Date().toISOString(),
        } as any,
      },
    });
    return { ok: true, cancelled: true };
  }

  private async getMyManualForeignCard(
    req: any,
    paymentSystem: ManualForeignCardPaymentSystem,
  ) {
    const depo = await this.prisma.deposit.findFirst({
      where: {
        userId: Number(req.user.id),
        paymentSystem,
        status: { in: ['PENDING', 'PROCESSING'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!depo) return {};
    const meta = (depo.meta as any) || {};
    if (
      depo.status === ('CANCELLED' as any) &&
      (meta.userCancelled || meta.lifecycle === 'CANCELLED_BY_USER')
    ) {
      return {};
    }
    const imageUrl = meta?.imageUrl as string | undefined;
    const isExpired =
      depo.status === ('CANCELLED' as any) &&
      (meta.autoCancelled || meta.lifecycle === 'EXPIRED');
    const publicOrderId = await ensurePublicOrderId(this.prisma, depo);
    return {
      id: depo.id,
      publicOrderId,
      amount: Number(depo.amount),
      currency: depo.currencyCode,
      method: depo.paymentSystem,
      imageUrl,
      brlAmount: meta.brlAmount as number | undefined,
      rubPerBrl: meta.rubPerBrl as number | undefined,
      status: isExpired
        ? 'expired'
        : depo.status === 'PENDING'
          ? 'pending'
          : depo.status === ('PROCESSING' as any)
            ? 'processing'
            : depo.status === ('FAILED' as any)
              ? 'rejected'
              : 'approved',
      createdAt: depo.createdAt,
      reason: isExpired
        ? meta.autoCancelledReason || 'Срок действия заявки истек'
        : undefined,
    };
  }

  private async handleManualForeignCardUpload(
    req: any,
    res: any,
    files: {
      receipt?: Express.Multer.File[];
      file?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    opts: {
      paymentSystem: ManualForeignCardPaymentSystem;
      defaultCurrency: string;
      minAmount: number;
      externalPrefix: string;
    },
  ) {
    this.winstonLogger.info(`${opts.paymentSystem} upload request received`, {
      context: 'DepositController',
    });

    const file: Express.Multer.File | undefined =
      files?.receipt?.[0] || files?.file?.[0] || files?.image?.[0];

    const voucherInputRaw: string = (req.body?.voucher ?? '').toString();
    const voucherInput: string | undefined = voucherInputRaw.trim() || undefined;

    if (voucherInput) {
      const voucherOk = await this.validateVoucherForDeposit(
        req,
        res,
        voucherInput,
        String(req.body?.currency || opts.defaultCurrency),
      );
      if (!voucherOk) return;
    }

    const rawAmount = req.body?.amount ?? req.query?.amount;
    const amountNum = parseFloat(String(rawAmount).replace(',', '.'));
    if (!amountNum || Number.isNaN(amountNum)) {
      throw new BadRequestException('Укажите сумму пополнения');
    }
    const currency = String(req.body?.currency || req.query?.currency || opts.defaultCurrency);
    if (amountNum < opts.minAmount) {
      throw new BadRequestException(
        `Минимальная сумма пополнения — ${opts.minAmount} ${currency}`,
      );
    }

    const userId = Number(req.user.id);
    const orderIdFromBody = req.body?.orderId
      ? Number(req.body.orderId)
      : undefined;

    let existing = null as any;
    if (orderIdFromBody && !Number.isNaN(orderIdFromBody)) {
      existing = await this.prisma.deposit.findFirst({
        where: {
          id: orderIdFromBody,
          userId,
          paymentSystem: opts.paymentSystem,
          status: { in: ['PENDING', 'PROCESSING'] as any },
        },
      });
    }
    if (!existing) {
      existing = await this.prisma.deposit.findFirst({
        where: {
          userId,
          paymentSystem: opts.paymentSystem,
          status: { in: ['PENDING', 'PROCESSING'] as any },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const imageUrl = file ? `/uploads/receipts/${file.filename}` : undefined;
    const nowIso = new Date().toISOString();
    const confirmMeta = {
      ...(imageUrl ? { imageUrl } : {}),
      voucher: voucherInput,
      lifecycle: imageUrl ? 'RECEIPT_UPLOADED' : 'PAYMENT_CONFIRMED',
      confirmedAt: nowIso,
      ...(imageUrl ? { receiptUploadedAt: nowIso } : {}),
    };

    if (existing) {
      const oldMeta = (existing.meta as any) || {};
      const updated = await this.prisma.deposit.update({
        where: { id: existing.id },
        data: {
          status: 'PROCESSING' as any,
          amount: new Decimal(amountNum),
          meta: { ...oldMeta, ...confirmMeta } as any,
        },
      });
      const respImage = ((updated.meta as any) || {}).imageUrl as string | undefined;
      const respVoucher = ((updated.meta as any) || {}).voucher as string | undefined;
      this.notifyTelegram({
        id: updated.id,
        userId: updated.userId,
        amount: Number(updated.amount),
        currency: updated.currencyCode,
        status: 'pending',
        method: updated.paymentSystem,
        imageUrl: respImage,
        voucher: respVoucher,
        createdAt: updated.createdAt,
      }).catch(() => null);

      const publicOrderId = await ensurePublicOrderId(this.prisma, updated);
      return {
        ok: true,
        order: {
          id: updated.id,
          publicOrderId,
          amount: Number(updated.amount),
          currency: updated.currencyCode,
          method: updated.paymentSystem,
          imageUrl: respImage,
          status: 'processing',
          createdAt: updated.createdAt,
        },
      };
    }

    const publicOrderId = await createUniquePublicOrderId(this.prisma);
    const created = await this.prisma.deposit.create({
      data: {
        userId,
        externalId: `${opts.externalPrefix}_${Date.now()}_${userId}`,
        paymentSystem: opts.paymentSystem,
        amount: new Decimal(amountNum),
        currencyCode: currency,
        status: 'PROCESSING' as any,
        meta: { ...confirmMeta, publicOrderId } as any,
      },
      include: { user: true },
    });

    this.notifyTelegram({
      id: created.id,
      userId: created.userId,
      amount: Number(created.amount),
      currency: created.currencyCode,
      status: 'pending',
      method: created.paymentSystem,
      imageUrl,
      voucher: voucherInput,
      createdAt: created.createdAt,
    }).catch(() => null);

    return {
      ok: true,
      order: {
        id: created.id,
        publicOrderId,
        amount: Number(created.amount),
        currency: created.currencyCode,
        method: created.paymentSystem,
        imageUrl,
        status: 'processing',
        createdAt: created.createdAt,
      },
    };
  }

  private async validateVoucherForDeposit(
    req: any,
    res: any,
    voucherInput: string,
    reqCurrency: string,
  ): Promise<boolean> {
    try {
      const promo = await this.prisma.promo.findFirst({
        where: {
          OR: [
            { code: voucherInput },
            { code: voucherInput?.toUpperCase?.() },
            { code: voucherInput?.toLowerCase?.() },
          ],
        },
        include: { _count: { select: { promoOnUsers: true } } } as any,
      } as any);
      const now = new Date();
      const expired = !promo || (promo.validUntil && new Date(promo.validUntil) < now);
      const used = (promo as any)?._count?.promoOnUsers || 0;
      const exhausted = promo ? Number(promo.available || 0) <= Number(used) : true;
      const currencyMismatch =
        promo &&
        promo.currencyCode &&
        String(promo.currencyCode).toUpperCase() !== reqCurrency.toUpperCase();
      if (!promo || expired || exhausted || currencyMismatch) {
        if (currencyMismatch) {
          res
            .status(400)
            .type('text/plain')
            .send(`Бонус-код доступен только для валюты ${promo?.currencyCode}`);
          return false;
        }
        res.status(400).type('text/plain').send('Нету такого кода. Введите правильный бонусный-код');
        return false;
      }
      return true;
    } catch {
      res.status(400).type('text/plain').send('Нету такого кода. Введите правильный бонусный-код');
      return false;
    }
  }
  @Get(':id(\\d+)')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deposit by ID' })
  @ApiParam({ name: 'id', description: 'Deposit ID' })
  @ApiOkResponse({ description: 'Deposit found' })
  @ApiNotFoundResponse({ description: 'Deposit not found' })
  async getDepositById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    try {
      const deposit = await this.depositService.getDepositById(id);
      if (!deposit) {
        throw new NotFoundException('Deposit not found');
      }
      if (Number(deposit.userId) !== Number(req.user.id)) {
        throw new ForbiddenException('Access denied');
      }
      return deposit;
    } catch (error) {
      this.logger.error(`Error getting deposit ${id}:`, error);
      throw error;
    }
  }

  private getStatusMessage(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'Депозит успешно зачислен на ваш счет';
      case 'ACCEPTED':
        return 'Депозит принят к обработке';
      case 'ERROR':
        return 'Произошла ошибка при обработке депозита';
      case 'PENDING':
        return 'Заявка на депозит ожидает подтверждения';
      case 'PROCESSING':
        return 'Заявка обрабатывается';
      case 'REJECTED':
        return 'Заявка отклонена администратором';
      default:
        return 'Неизвестный статус депозита';
    }
  }

  // Notify Telegram bot via HTTP POST
  private async notifyTelegram(args: {
    id: number;
    userId: number;
    amount: number;
    currency: string;
    status: string;
    method?: string;
    imageUrl?: string;
    voucher?: string;
    createdAt?: Date;
  }) {
    try {
      const settings = loadPaymentSettings();
      if (!settings.notifications.telegramDepositNotify) return;

      const url = process.env.TELEGRAM_NOTIFY_URL;
      if (!url) return;
      const makeAbsolute = (u?: string) => {
        if (!u) return undefined;
        if (u.startsWith('http://') || u.startsWith('https://')) return u;
        const base = (process.env.BASE_URL || 'https://imba.bet');
        return `${base}${u.startsWith('/') ? u : '/' + u}`;
      };
      const payload = {
        depositId: args.id,
        userId: args.userId,
        amount: args.amount,
        currency: args.currency,
        status: args.status,
        method: args.method,
        imageUrl: makeAbsolute(args.imageUrl),
        voucher: args.voucher,
        createdAt: args.createdAt ? args.createdAt.toISOString() : undefined,
      };
      this.winstonLogger.info(`Notify TG URL: ${url}`, { context: 'DepositController' });
      this.winstonLogger.info(`Notify TG payload: ${JSON.stringify(payload)}`, { context: 'DepositController' });
      const fetchFn: any = (globalThis as any).fetch;
      if (!fetchFn) return;
      const notifySecret = process.env.TELEGRAM_NOTIFY_SECRET;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (notifySecret) {
        headers['X-Notify-Secret'] = notifySecret;
      }
      const resp = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let bodyText: string | undefined;
        try { bodyText = await resp.text(); } catch {}
        this.winstonLogger.warn(
          `Notify TG failed with status ${resp.status}. Body: ${bodyText || '<no body>'}`,
          { context: 'DepositController' }
        );
      }
    } catch (e: any) {
      this.winstonLogger.warn(`Notify TG failed: ${e?.message || e}`, { context: 'DepositController' });
    }
  }
}