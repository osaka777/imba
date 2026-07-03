import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';

import { PrismaService } from '~/prisma/prisma.service';
import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramNotify: TelegramNotifyService,
    private readonly config: ConfigService,
  ) {}

  async requestCode(userId: number, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!/^\d{10,12}$/.test(phone)) {
      throw new BadRequestException('Некорректный номер телефона');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramUserId: true, phoneVerifiedAt: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.phoneVerifiedAt) {
      throw new BadRequestException('Телефон уже подтверждён');
    }
    if (!user.telegramUserId) {
      throw new BadRequestException(
        'Привяжите Telegram в настройках — код подтверждения придёт в бот',
      );
    }

    const recent = await this.prisma.phoneVerificationChallenge.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent > 0) {
      throw new HttpException('Подождите минуту перед повторной отправкой', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(100_000, 999_999));
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    await this.prisma.phoneVerificationChallenge.create({
      data: {
        userId,
        phone,
        codeHash: hashCode(code),
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    const masked = `+${phone.slice(0, phone.length - 4).replace(/\d/g, '•')}${phone.slice(-4)}`;
    await this.telegramNotify.sendUserMessage(
      user.telegramUserId,
      `📱 Подтверждение телефона imba.bet\n\nКод: ${code}\nНомер: ${masked}\nДействует 10 минут.`,
    );

    return { ok: true, phoneMasked: masked };
  }

  async verifyCode(userId: number, code: string) {
    const normalized = code.replace(/\D/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Введите 6-значный код');
    }

    const challenge = await this.prisma.phoneVerificationChallenge.findFirst({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.codeHash !== hashCode(normalized)) {
      throw new BadRequestException('Неверный или просроченный код');
    }

    await this.prisma.$transaction([
      this.prisma.phoneVerificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: challenge.phone,
          phoneVerifiedAt: new Date(),
        },
      }),
    ]);

    return { ok: true, phoneVerified: true };
  }

  getWithdrawalLimits(phoneVerifiedAt: Date | null | undefined, currencyCode: string) {
    const verifiedDaily = Number(
      this.config.get(`KYC_VERIFIED_DAILY_WITHDRAW_${currencyCode}`)
      ?? this.config.get('KYC_VERIFIED_DAILY_WITHDRAW_KZT', '500000'),
    );
    const unverifiedDaily = Number(
      this.config.get(`KYC_UNVERIFIED_DAILY_WITHDRAW_${currencyCode}`)
      ?? this.config.get('KYC_UNVERIFIED_DAILY_WITHDRAW_KZT', '50000'),
    );

    return {
      phoneVerified: Boolean(phoneVerifiedAt),
      dailyLimit: phoneVerifiedAt ? verifiedDaily : unverifiedDaily,
      currencyCode,
    };
  }

  async assertWithdrawalWithinLimit(
    userId: number,
    amount: number,
    currencyCode: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerifiedAt: true },
    });
    const limits = this.getWithdrawalLimits(user?.phoneVerifiedAt, currencyCode);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayTotal = await this.prisma.withdrawRequest.aggregate({
      where: {
        userId,
        currencyCode,
        createdAt: { gte: startOfDay },
        status: { in: ['WAITING', 'SUCCESS'] },
      },
      _sum: { amount: true },
    });

    const spent = Number(todayTotal._sum.amount ?? 0);
    if (spent + amount > limits.dailyLimit) {
      const remaining = Math.max(0, limits.dailyLimit - spent);
      if (!limits.phoneVerified) {
        throw new BadRequestException(
          `Лимит вывода без верификации: ${limits.dailyLimit} ${currencyCode}/день. `
          + `Осталось ${remaining.toFixed(0)}. Подтвердите телефон в настройках.`,
        );
      }
      throw new BadRequestException(
        `Дневной лимит вывода: ${limits.dailyLimit} ${currencyCode}. Осталось ${remaining.toFixed(0)}.`,
      );
    }
  }
}
