import { Module } from '@nestjs/common';

import { EventModule } from '~/main/event/event.module';
import { OperationModule } from '~/main/operation/operation.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { PushModule } from '~/main/push/push.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { CybersportModule } from '../cybersport/cybersport.module';
import { KickChannelLiveModule } from '../kick-live/kick-channel-live.module';
import { OlimpbetAuthService } from '../olimpbet-wc/olimpbet-auth.service';
import { OlimpbetHttpClient } from '../olimpbet-wc/olimpbet-http.client';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { OneWinWcModule } from '../onewin-wc/onewin-wc.module';
import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { WcEventMatchStateService } from './wc-event-match-state.service';
import { FeedSessionController } from './feed-session.controller';
import { WcOddsController } from './wc-odds.controller';
import { WcOddsGateway } from './wc-odds.gateway';
import { WcOddsBetService } from './wc-odds-bet.service';
import { WcOddsCashoutService } from './wc-odds-cashout.service';
import { WcOddsExpressService } from './wc-odds-express.service';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcOddsSyncService } from './wc-odds-sync.service';
import { WcSocialPulseController } from './wc-social-pulse.controller';
import { WcSocialPulseService } from './wc-social-pulse.service';
import { WcTelegramPulseService } from './wc-telegram-pulse.service';

@Module({
  controllers: [FeedSessionController, WcOddsController, WcSocialPulseController],
  exports: [OlimpbetWcService, WcOddsRealtimeService, WcOddsBetService],
  imports: [
    PrismaModule,
    OperationModule,
    PartnersModule,
    AuthenticationModule,
    CybersportModule,
    EventModule,
    TelegramModule,
    PushModule,
    KickChannelLiveModule,
    OneWinWcModule,
  ],
  providers: [
    OlimpbetAuthService,
    OlimpbetHttpClient,
    OlimpbetWcService,
    WcBroadcastProxyService,
    WcOddsBetService,
    WcEventMatchStateService,
    WcOddsSyncService,
    WcOddsSettlementService,
    WcOddsCashoutService,
    WcOddsExpressService,
    WcOddsGateway,
    WcOddsRealtimeService,
    WcSocialPulseService,
    WcTelegramPulseService,
  ],
})
export class WcOddsModule {}
