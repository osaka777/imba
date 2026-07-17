import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UserModule } from '~/main/user/user.module';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { AuthRateLimitGuard } from '~/common/guards/auth-rate-limit.guard';
import { OperationModule } from '~/main/operation/operation.module';
import { EventModule } from '~/main/event/event.module';

import { PasswordResetService } from './password-reset.service';
import { Telegram2faService } from './telegram-2fa.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramNotificationLogService } from './telegram-notification-log.service';
import { TelegramNotifyService } from './telegram-notify.service';
import { TelegramUserNotifyService } from './telegram-user-notify.service';

@Module({
  controllers: [TelegramController],
  exports: [
    TelegramNotifyService,
    TelegramLinkService,
    TelegramUserNotifyService,
    Telegram2faService,
    TelegramAuthService,
  ],
  imports: [
    PrismaModule,
    JwtModule,
    OperationModule,
    EventModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthenticationModule),
  ],
  providers: [
    TelegramLinkService,
    TelegramAuthService,
    TelegramNotifyService,
    TelegramUserNotifyService,
    TelegramNotificationLogService,
    TelegramBotService,
    Telegram2faService,
    PasswordResetService,
    AuthRateLimitGuard,
  ],
})
export class TelegramModule {}
