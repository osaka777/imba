import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthenticationGuard } from '~/main/user/authentication/authentication.guard';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';
import { extractClientIp } from '~/common/utils/client-ip.util';
import { EventGateway } from '~/main/event/event.gateway';
import { PrismaService } from '~/prisma/prisma.service';

import { CompleteTelegramLinkDto, ForgotPasswordDto, ResetPasswordDto } from './dto/telegram.dto';
import {
  TelegramBotCommandDto,
  UpdateTelegram2faDto,
  UpdateTelegramNotificationsDto,
} from './dto/telegram-notify.dto';
import { PasswordResetService } from './password-reset.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramLinkService } from './telegram-link.service';

function assertNotifySecret(header?: string): void {
  const secret = process.env.TELEGRAM_NOTIFY_SECRET;
  if (!secret) return;
  if (!header || header !== secret) {
    throw new UnauthorizedException();
  }
}

@Controller('')
@ApiTags('Telegram')
export class TelegramController {
  constructor(
    private readonly linkService: TelegramLinkService,
    private readonly passwordResetService: PasswordResetService,
    private readonly botService: TelegramBotService,
    private readonly prisma: PrismaService,
    private readonly eventGateway: EventGateway,
  ) {}

  @Post('user/telegram/link-token')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async createLinkToken(@Req() req: { user: { id: number } }) {
    const result = await this.linkService.createLinkToken(req.user.id);
    return {
      deepLink: result.deepLink,
      botUsername: this.linkService.getBotUsername(),
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Delete('user/telegram')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  async unlinkTelegram(@Req() req: { user: { id: number } }) {
    await this.linkService.unlink(req.user.id);
  }

  @Post('telegram/complete-link')
  @HttpCode(200)
  async completeLink(
    @Body() body: CompleteTelegramLinkDto,
    @Headers('x-notify-secret') notifySecret?: string,
  ) {
    assertNotifySecret(notifySecret);
    const result = await this.linkService.completeLink(body);

    this.eventGateway.sendUserNotification(String(result.userId), {
      type: 'telegram_linked',
      payload: {
        telegramUsername: body.telegramUsername?.replace(/^@/, '') ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return { ok: true, ...result };
  }

  @Post('auth/forgot-password')
  @UseGuards(AuthRateLimitGuard)
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) {
    return this.passwordResetService.requestReset(body.email, extractClientIp(req));
  }

  @Post('auth/reset-password')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(204)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(body.token, body.newPassword);
  }

  @Get('user/telegram/notifications')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async getTelegramNotifications(@Req() req: { user: { id: number } }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        telegramLinkedAt: true,
        telegramNotifyDeposit: true,
        telegramNotifyWithdraw: true,
        telegramNotifyBets: true,
        telegramNotifyPromo: true,
        telegram2faEnabled: true,
        telegramNotifyLiveMatch: true,
        telegramNotifyPreMatch: true,
      },
    });
    return {
      linked: Boolean(user?.telegramLinkedAt),
      deposit: user?.telegramNotifyDeposit ?? true,
      withdraw: user?.telegramNotifyWithdraw ?? true,
      bets: user?.telegramNotifyBets ?? true,
      promo: user?.telegramNotifyPromo ?? false,
      twoFaEnabled: user?.telegram2faEnabled ?? false,
      liveMatch: user?.telegramNotifyLiveMatch ?? true,
      preMatch: user?.telegramNotifyPreMatch ?? true,
    };
  }

  @Patch('user/telegram/notifications')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async updateTelegramNotifications(
    @Req() req: { user: { id: number } },
    @Body() body: UpdateTelegramNotificationsDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramLinkedAt: true },
    });
    if (!user?.telegramLinkedAt) {
      return { ok: false, reason: 'not_linked' };
    }

    const data: Record<string, boolean> = {};
    if (body.deposit !== undefined) data.telegramNotifyDeposit = body.deposit;
    if (body.withdraw !== undefined) data.telegramNotifyWithdraw = body.withdraw;
    if (body.bets !== undefined) data.telegramNotifyBets = body.bets;
    if (body.promo !== undefined) data.telegramNotifyPromo = body.promo;
    if (body.liveMatch !== undefined) data.telegramNotifyLiveMatch = body.liveMatch;
    if (body.preMatch !== undefined) data.telegramNotifyPreMatch = body.preMatch;

    if (Object.keys(data).length) {
      await this.prisma.user.update({
        where: { id: req.user.id },
        data,
      });
    }

    return { ok: true };
  }

  @Patch('user/telegram/2fa')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  async updateTelegram2fa(
    @Req() req: { user: { id: number } },
    @Body() body: UpdateTelegram2faDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramLinkedAt: true },
    });
    if (!user?.telegramLinkedAt) {
      return { ok: false, reason: 'not_linked' };
    }

    await this.prisma.user.update({
      where: { id: req.user.id },
      data: { telegram2faEnabled: body.enabled },
    });

    return { ok: true, enabled: body.enabled };
  }

  @Post('telegram/bot/command')
  @HttpCode(200)
  async botCommand(
    @Body() body: TelegramBotCommandDto,
    @Headers('x-notify-secret') notifySecret?: string,
  ) {
    assertNotifySecret(notifySecret);
    try {
      const message = await this.botService.processCommand(
        body.telegramUserId,
        body.command,
      );
      if (message === '__UNLINK_CONFIRM__') {
        return {
          message: 'Отвязать Telegram от imba.bet?',
          unlinkConfirm: true,
        };
      }
      return { message };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        return { message: String(error.message) };
      }
      throw error;
    }
  }
}
