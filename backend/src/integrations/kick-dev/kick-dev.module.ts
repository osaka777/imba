import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthenticationModule } from '~/main/partners/authentication/authentication.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickChannelLiveModule } from '~/integrations/kick-live/kick-channel-live.module';
import { WcOddsModule } from '~/integrations/wc-odds/wc-odds.module';

import { KickDevController, KickPartnerController } from './kick-dev.controller';
import { KickChatRateLimitService } from './kick-chat-rate-limit.service';
import { KickChatService } from './kick-chat.service';
import { KickChallengeModule } from './kick-challenge.module';
import { KickConnectBonusModule } from './kick-connect-bonus.module';
import { KickGuessContestModule } from './kick-guess-contest.module';
import { KickMonthSprintModule } from './kick-month-sprint.module';
import { KickStreakModule } from './kick-streak.module';
import { KickStreamRaceModule } from './kick-stream-race.module';
import { KickCredentialService } from './kick-credential.service';
import { KickDevService } from './kick-dev.service';
import { KickPartnerPollService } from './kick-partner-poll.service';
import { KickPartnerService } from './kick-partner.service';
import { KickRetentionNotifyService } from './kick-retention-notify.service';
import { KickTokenAlertService } from './kick-token-alert.service';
import { KickTokenMaintenanceService } from './kick-token-maintenance.service';
import { KickTokenService } from './kick-token.service';
import { KickWidgetAlertService } from './kick-widget-alert.service';
import { KickWebhookService } from './kick-webhook.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthenticationModule, TelegramModule, KickChannelLiveModule, KickConnectBonusModule, KickChallengeModule, KickStreamRaceModule, KickStreakModule, KickMonthSprintModule, KickGuessContestModule, WcOddsModule],
  controllers: [KickDevController, KickPartnerController],
  providers: [
    KickDevService,
    KickCredentialService,
    KickTokenService,
    KickPartnerService,
    KickWebhookService,
    KickChatService,
    KickChatRateLimitService,
    KickPartnerPollService,
    KickTokenMaintenanceService,
    KickTokenAlertService,
    KickRetentionNotifyService,
    KickWidgetAlertService,
  ],
  exports: [
    KickDevService,
    KickCredentialService,
    KickTokenService,
    KickPartnerService,
    KickWebhookService,
    KickChatService,
    KickPartnerPollService,
    KickTokenMaintenanceService,
    KickTokenAlertService,
    KickConnectBonusModule,
  ],
})
export class KickDevModule {}
