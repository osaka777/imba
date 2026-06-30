import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '~/prisma/prisma.service';
import { UserService } from '~/main/user/user.service';

import { TelegramUserNotifyService } from './telegram-user-notify.service';
import { TelegramNotifyService } from './telegram-notify.service';
import { getPublicSiteBaseUrl } from './public-site-url.util';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export type ForgotPasswordResult = {
  ok: true;
  channel: 'telegram' | 'none';
};

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly telegramNotify: TelegramNotifyService,
    private readonly telegramUserNotify: TelegramUserNotifyService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private siteBaseUrl(): string {
    return getPublicSiteBaseUrl();
  }

  async requestReset(email: string, requestIp?: string): Promise<ForgotPasswordResult> {
    const normalized = email.trim().toLowerCase();
    const user = await this.userService.findByEmail(normalized);

    if (!user?.telegramUserId) {
      return { ok: true, channel: 'none' };
    }

    const now = new Date();
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          { expiresAt: { lt: now } },
        ],
      },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const resetUrl = `${this.siteBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const ipLine = requestIp ? `\nIP запроса: ${requestIp}` : '';
    const alertMessage = [
      '🔐 Запрошен сброс пароля imba.bet',
      ipLine,
      '',
      'Если это были не вы — проигнорируйте следующее сообщение и проверьте безопасность аккаунта.',
    ].join('\n');

    await this.telegramUserNotify.notifySecurity({
      userId: user.id,
      telegramUserId: user.telegramUserId,
      type: 'password_reset_request',
      message: alertMessage,
    });

    const message = [
      '🔐 Сброс пароля imba.bet',
      '',
      'Перейдите по ссылке (действует 30 мин):',
      resetUrl,
      '',
      'Если это были не вы — просто проигнорируйте сообщение.',
    ].join('\n');

    await this.telegramNotify.sendUserMessage(user.telegramUserId, message);

    return { ok: true, channel: 'telegram' };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await hash(
      newPassword,
      this.config.get<string>('PASSWORD_HASH_SALT'),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: record.userId,
          NOT: { id: record.id },
        },
      }),
    ]);

    if (record.user.telegramUserId) {
      await this.telegramUserNotify.notifySecurity({
        userId: record.userId,
        telegramUserId: record.user.telegramUserId,
        type: 'password_reset_done',
        message: '✅ Пароль imba.bet успешно изменён.\n\nЕсли это были не вы — срочно свяжитесь с поддержкой.',
      });
    }
  }
}
