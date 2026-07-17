import { Injectable } from '@nestjs/common';

import { AuthenticationService } from '~/main/user/authentication/authentication.service';
import { TelegramNotifyService } from '~/main/telegram/telegram-notify.service';
import { PrismaService } from '~/prisma/prisma.service';

import { CreateSupportMessageDto } from './dto/create-support-message.dto';

type RequestMeta = {
  authorization?: string;
  cookies?: Record<string, string | undefined>;
  ip?: string;
};

@Injectable()
export class SupportService {
  constructor(
    private readonly telegramNotify: TelegramNotifyService,
    private readonly prisma: PrismaService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  getPublicConfig() {
    return {
      telegramUrl:
        process.env.SUPPORT_TELEGRAM_URL ||
        process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ||
        'https://t.me/imbabetchat',
      telegramLabel: process.env.SUPPORT_TELEGRAM_LABEL || 'Чат поддержки',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'imbabetalert_bot',
    };
  }

  private extractToken(meta: RequestMeta): string | undefined {
    if (meta.cookies?.accessToken) return meta.cookies.accessToken;
    if (meta.cookies?.access_token) return meta.cookies.access_token;
    const [type, token] = meta.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;
    return undefined;
  }

  private async resolveUser(meta: RequestMeta) {
    const token = this.extractToken(meta);
    if (!token) return null;
    try {
      return await this.authenticationService.verify(token);
    } catch {
      return null;
    }
  }

  async sendMessage(dto: CreateSupportMessageDto, meta: RequestMeta) {
    const user = await this.resolveUser(meta);
    let profile: {
      email: string | null;
      telegramUsername: string | null;
      telegramUserId: string | null;
    } | null = null;

    if (user?.id) {
      const userId = Number(user.id);
      profile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          telegramUsername: true,
          telegramUserId: true,
        },
      });
    }

    const lines = [
      '💬 Поддержка imba.bet',
      user?.id ? `Пользователь: #${user.id}` : 'Пользователь: гость',
    ];

    if (profile?.email) lines.push(`Email: ${profile.email}`);
    if (profile?.telegramUsername) {
      lines.push(`Telegram: @${profile.telegramUsername.replace(/^@/, '')}`);
    } else if (profile?.telegramUserId) {
      lines.push(`Telegram ID: ${profile.telegramUserId}`);
    }
    if (meta.ip) lines.push(`IP: ${meta.ip}`);
    if (dto.pageUrl) lines.push(`Страница: ${dto.pageUrl}`);
    if (dto.pageTitle) lines.push(`Раздел: ${dto.pageTitle}`);
    lines.push('', dto.message.trim());

    const result = await this.telegramNotify.sendSupportMessage(lines.join('\n'));
    return {
      ok: result.ok,
      telegramUrl: this.getPublicConfig().telegramUrl,
      error: result.error,
    };
  }
}
