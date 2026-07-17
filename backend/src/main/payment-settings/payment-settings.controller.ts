import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SuperuserGuard } from '../user/authentication/superuser.guard';
import {
  loadPaymentSettings,
  PaymentSettingsFile,
  savePaymentSettings,
} from './payment-settings.store';

const qrDir = './uploads/qr';
if (!existsSync(qrDir)) {
  mkdirSync(qrDir, { recursive: true });
}

@Controller('admin/payment-settings')
@UseGuards(SuperuserGuard)
export class AdminPaymentSettingsController {
  @Get()
  getSettings() {
    const settings = loadPaymentSettings();
    return {
      ...settings,
      telegram: {
        notifyUrl: process.env.TELEGRAM_NOTIFY_URL || '',
        hasSecret: Boolean(process.env.TELEGRAM_NOTIFY_SECRET),
        chatId: process.env.TELEGRAM_CHAT_ID || process.env.CHAT_ID || '',
      },
    };
  }

  @Put()
  updateSettings(@Body() body: Partial<PaymentSettingsFile>) {
    const current = loadPaymentSettings();
    const mergeItem = (
      currency: 'KZT' | 'KZT_KASPI' | 'RUB' | 'RUB_SBERBANK' | 'RUB_YANDEX_BANK' | 'USDT',
      patch?: Partial<PaymentSettingsFile['manualDeposit']['KZT']>,
    ) => {
      const merged = { ...current.manualDeposit[currency], ...patch };
      if (patch && Object.prototype.hasOwnProperty.call(patch, 'qrImageUrl')) {
        merged.qrImageUrl = String(patch.qrImageUrl ?? '').trim();
      }
      return merged;
    };
    const next: PaymentSettingsFile = {
      manualDeposit: {
        KZT: mergeItem('KZT', body.manualDeposit?.KZT),
        KZT_KASPI: mergeItem('KZT_KASPI', body.manualDeposit?.KZT_KASPI),
        RUB: mergeItem('RUB', body.manualDeposit?.RUB),
        RUB_SBERBANK: mergeItem('RUB_SBERBANK', body.manualDeposit?.RUB_SBERBANK),
        RUB_YANDEX_BANK: mergeItem('RUB_YANDEX_BANK', body.manualDeposit?.RUB_YANDEX_BANK),
        USDT: mergeItem('USDT', body.manualDeposit?.USDT),
      },
      paymentMethods: {
        ...current.paymentMethods,
        ...body.paymentMethods,
      },
      notifications: {
        ...current.notifications,
        ...body.notifications,
      },
    };
    savePaymentSettings(next);
    return { ok: true, settings: next };
  }

  @Post('upload-qr')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: qrDir,
        filename: (req, file, cb) => {
          const currency = String(req.body?.currency || 'kzt').toLowerCase();
          const suffix = Date.now();
          cb(null, `${currency}-qr-${suffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadQr(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const webPath = `uploads/qr/${file.filename}`;
    return {
      filename: file.filename,
      path: webPath,
      url: `/${webPath}`,
    };
  }
}

@Controller('deposit/payment-settings')
export class PublicPaymentSettingsController {
  @Get()
  getPublicSettings() {
    const settings = loadPaymentSettings();
    return {
      manualDeposit: {
        KZT: {
          enabled: settings.manualDeposit.KZT.enabled !== false,
          minAmount: settings.manualDeposit.KZT.minAmount,
        },
        KZT_KASPI: {
          enabled: settings.manualDeposit.KZT_KASPI.enabled !== false,
          minAmount: settings.manualDeposit.KZT_KASPI.minAmount,
        },
        RUB: {
          enabled: settings.manualDeposit.RUB.enabled !== false,
          minAmount: settings.manualDeposit.RUB.minAmount,
        },
        RUB_SBERBANK: {
          enabled: settings.manualDeposit.RUB_SBERBANK.enabled !== false,
          minAmount: settings.manualDeposit.RUB_SBERBANK.minAmount,
        },
        RUB_YANDEX_BANK: {
          enabled: settings.manualDeposit.RUB_YANDEX_BANK.enabled !== false,
          minAmount: settings.manualDeposit.RUB_YANDEX_BANK.minAmount,
        },
        USDT: {
          enabled: settings.manualDeposit.USDT.enabled !== false,
          minAmount: settings.manualDeposit.USDT.minAmount,
        },
      },
      paymentMethods: settings.paymentMethods,
      notifications: settings.notifications,
    };
  }
}
