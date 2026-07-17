import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { extractClientIp } from '~/common/utils/client-ip.util';
import { AuthenticationService } from '~/main/user/authentication/authentication.service';
import { UserService } from '~/main/user/user.service';

import {
  TelegramCompleteProfileDto,
  TelegramWidgetAuthDto,
} from './dto/telegram-auth.dto';
import {
  telegramAuthEmail,
  verifyTelegramWidgetAuth,
} from './telegram-auth.util';

type TelegramProfilePayload = {
  kind: 'telegram_profile';
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string;
};

@Injectable()
export class TelegramAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UserService,
    private readonly authenticationService: AuthenticationService,
  ) {}

  getBotUsername(): string {
    return process.env.TELEGRAM_BOT_USERNAME || 'imbabetalert_bot';
  }

  getBotId(): string {
    const token = this.getBotToken();
    const botId = token.split(':')[0];
    if (!/^\d+$/.test(botId)) {
      throw new BadRequestException('Telegram login is not configured');
    }
    return botId;
  }

  private getBotToken(): string {
    const token =
      this.config.get<string>('TELEGRAM_BOT_TOKEN')
      || process.env.BOT_TOKEN
      || '';
    if (!token) {
      throw new BadRequestException('Telegram login is not configured');
    }
    return token;
  }

  private assertWidgetAuth(dto: TelegramWidgetAuthDto): void {
    if (!verifyTelegramWidgetAuth(dto, this.getBotToken())) {
      throw new UnauthorizedException('Invalid Telegram authorization');
    }
  }

  private normalizeUsername(username?: string | null): string | null {
    const value = username?.replace(/^@/, '').trim();
    return value || null;
  }

  private async issueAccessToken(userId: number): Promise<string> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.authenticationService.authenticateUser(user);
  }

  private signProfileToken(payload: TelegramProfilePayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: this.config.get<string>('JWT_SECRET'),
    });
  }

  private verifyProfileToken(token: string): TelegramProfilePayload {
    try {
      const payload = this.jwtService.verify<TelegramProfilePayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.kind !== 'telegram_profile' || !payload.telegramUserId) {
        throw new UnauthorizedException('Invalid profile token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired profile token');
    }
  }

  async authenticateWithWidget(
    dto: TelegramWidgetAuthDto,
    request?: Request,
  ): Promise<{
    accessToken?: string;
    requiresProfile?: boolean;
    profileToken?: string;
    isNewUser?: boolean;
  }> {
    this.assertWidgetAuth(dto);

    const telegramUserId = String(dto.id);
    const telegramUsername = this.normalizeUsername(dto.username);
    const existing = await this.usersService.findByTelegramUserId(telegramUserId);

    if (existing) {
      return {
        accessToken: await this.issueAccessToken(existing.id),
        isNewUser: false,
      };
    }

    if (dto.mode === 'login') {
      throw new NotFoundException('Telegram account is not registered');
    }

    if (dto.currencyCode && dto.birthDate) {
      const registrationIp = request ? extractClientIp(request) : undefined;
      const deviceId = request?.headers['x-client-device-id'] as string | undefined;
      const user = await this.usersService.createFromTelegram({
        telegramUserId,
        telegramUsername,
        firstName: dto.first_name,
        currencyCode: dto.currencyCode,
        birthDate: dto.birthDate,
        tag: dto.tag,
        promoCode: dto.promoCode,
        subs: dto.subs,
        registrationIp,
        registrationDeviceId: deviceId,
      });

      return {
        accessToken: await this.issueAccessToken(user.id),
        isNewUser: true,
      };
    }

    return {
      requiresProfile: true,
      profileToken: this.signProfileToken({
        kind: 'telegram_profile',
        telegramUserId,
        telegramUsername,
        firstName: dto.first_name,
      }),
      isNewUser: true,
    };
  }

  async completeProfile(
    dto: TelegramCompleteProfileDto,
    request?: Request,
  ): Promise<{ accessToken: string; isNewUser: boolean }> {
    const profile = this.verifyProfileToken(dto.profileToken);
    const existing = await this.usersService.findByTelegramUserId(
      profile.telegramUserId,
    );
    if (existing) {
      return {
        accessToken: await this.issueAccessToken(existing.id),
        isNewUser: false,
      };
    }

    const registrationIp = request ? extractClientIp(request) : undefined;
    const deviceId = request?.headers['x-client-device-id'] as string | undefined;
    const user = await this.usersService.createFromTelegram({
      telegramUserId: profile.telegramUserId,
      telegramUsername: profile.telegramUsername,
      firstName: profile.firstName,
      currencyCode: dto.currencyCode,
      birthDate: dto.birthDate,
      tag: dto.tag,
      promoCode: dto.promoCode,
      subs: dto.subs,
      registrationIp,
      registrationDeviceId: deviceId,
    });

    return {
      accessToken: await this.issueAccessToken(user.id),
      isNewUser: true,
    };
  }

  buildSyntheticEmail(telegramUserId: string | number): string {
    return telegramAuthEmail(telegramUserId);
  }
}
