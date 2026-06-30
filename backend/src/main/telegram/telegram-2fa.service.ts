import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';

import { PrismaService } from '~/prisma/prisma.service';

import { TelegramNotifyService } from './telegram-notify.service';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class Telegram2faService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramNotify: TelegramNotifyService,
  ) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async isTrustedDevice(userId: number, deviceId?: string): Promise<boolean> {
    if (!deviceId?.trim()) return false;
    const row = await this.prisma.userTrustedDevice.findUnique({
      where: {
        userId_deviceId: { userId, deviceId: deviceId.trim() },
      },
    });
    return Boolean(row);
  }

  async rememberDevice(userId: number, deviceId?: string): Promise<void> {
    if (!deviceId?.trim()) return;
    await this.prisma.userTrustedDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId: deviceId.trim() },
      },
      create: { userId, deviceId: deviceId.trim() },
      update: { lastSeenAt: new Date() },
    });
  }

  async shouldChallenge(user: {
    id: number;
    telegram2faEnabled: boolean;
    telegramUserId: string | null;
  }, deviceId?: string): Promise<boolean> {
    if (!user.telegram2faEnabled || !user.telegramUserId) return false;
    return !(await this.isTrustedDevice(user.id, deviceId));
  }

  async createChallenge(input: {
    userId: number;
    telegramUserId: string;
    requestIp?: string;
  }): Promise<{ twoFaToken: string }> {
    const code = String(randomInt(100000, 999999));
    const twoFaToken = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await this.prisma.telegramLoginChallenge.create({
      data: {
        id: twoFaToken,
        userId: input.userId,
        codeHash: this.hashCode(code),
        requestIp: input.requestIp,
        expiresAt,
      },
    });

    const ipLine = input.requestIp ? `\nIP: ${input.requestIp}` : '';
    await this.telegramNotify.sendUserMessage(
      input.telegramUserId,
      `🔐 Код входа imba.bet: ${code}\n\nДействует 5 минут.${ipLine}\nЕсли это не вы — смените пароль.`,
    );

    return { twoFaToken };
  }

  async verifyChallenge(input: {
    twoFaToken: string;
    code: string;
    deviceId?: string;
  }): Promise<{ userId: number }> {
    const challenge = await this.prisma.telegramLoginChallenge.findUnique({
      where: { id: input.twoFaToken.trim() },
    });

    if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired 2FA code');
    }

    if (challenge.codeHash !== this.hashCode(input.code.trim())) {
      throw new BadRequestException('Invalid or expired 2FA code');
    }

    await this.prisma.telegramLoginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    await this.rememberDevice(challenge.userId, input.deviceId);

    return { userId: challenge.userId };
  }
}
