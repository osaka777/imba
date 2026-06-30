import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';

import { PrismaService } from '~/prisma/prisma.service';

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class TelegramLinkService {
  constructor(private readonly prisma: PrismaService) {}

  getBotUsername(): string {
    return process.env.TELEGRAM_BOT_USERNAME || 'imbabetalert_bot';
  }

  buildDeepLink(token: string): string {
    return `https://t.me/${this.getBotUsername()}?start=link_${token}`;
  }

  async createLinkToken(userId: number): Promise<{ deepLink: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.telegramUserId) {
      throw new ConflictException('Telegram already linked');
    }

    const now = new Date();
    await this.prisma.telegramLinkToken.deleteMany({
      where: {
        OR: [
          { userId },
          { expiresAt: { lt: now } },
        ],
      },
    });

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MS);

    await this.prisma.telegramLinkToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return {
      deepLink: this.buildDeepLink(token),
      expiresAt,
    };
  }

  async completeLink(args: {
    token: string;
    telegramUserId: string;
    telegramUsername?: string | null;
  }): Promise<{ userId: number; email: string }> {
    const linkToken = await this.prisma.telegramLinkToken.findUnique({
      where: { token: args.token },
      include: { user: true },
    });

    if (!linkToken || linkToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired link token');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        telegramUserId: args.telegramUserId,
        NOT: { id: linkToken.userId },
      },
    });
    if (existing) {
      throw new ConflictException('This Telegram account is already linked to another user');
    }

    const username = args.telegramUsername?.replace(/^@/, '').trim() || null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: linkToken.userId },
        data: {
          telegramUserId: args.telegramUserId,
          telegramUsername: username,
          telegramLinkedAt: new Date(),
        },
      }),
      this.prisma.telegramLinkToken.deleteMany({ where: { userId: linkToken.userId } }),
    ]);

    return {
      userId: linkToken.userId,
      email: linkToken.user.email,
    };
  }

  async unlink(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.telegramUserId) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramUserId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });
  }
}
