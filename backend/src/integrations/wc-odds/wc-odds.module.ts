import { Module } from '@nestjs/common';

import { EventModule } from '~/main/event/event.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { PushModule } from '~/main/push/push.module';
import { OperationModule } from '~/main/operation/operation.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { CybersportModule } from '../cybersport/cybersport.module';
import { OlimpbetAuthService } from '../olimpbet-wc/olimpbet-auth.service';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { WcOddsExpressService } from './wc-odds-express.service';
import { WcOddsBetService } from './wc-odds-bet.service';
import { WcEventMatchStateService } from './wc-event-match-state.service';
import { WcOddsCashoutService } from './wc-odds-cashout.service';
import { WcOddsController } from './wc-odds.controller';
import { WcOddsGateway } from './wc-odds.gateway';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcOddsSyncService } from './wc-odds-sync.service';
import { WcTelegramPulseService } from './wc-telegram-pulse.service';

@Module({
  imports: [PrismaModule, OperationModule, PartnersModule, AuthenticationModule, CybersportModule, EventModule, TelegramModule, PushModule],
  controllers: [WcOddsController],
  providers: [
    OlimpbetAuthService,
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
    WcTelegramPulseService,
  ],
  exports: [OlimpbetWcService, WcOddsRealtimeService, WcOddsBetService],
})
export class WcOddsModule {}
