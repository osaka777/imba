import { Module } from '@nestjs/common';

import { EventModule } from '~/main/event/event.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { OperationModule } from '~/main/operation/operation.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { CybersportModule } from '../cybersport/cybersport.module';
import { OlimpbetAuthService } from '../olimpbet-wc/olimpbet-auth.service';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';

import { WcBroadcastProxyService } from './wc-broadcast-proxy.service';
import { WcOddsBetService } from './wc-odds-bet.service';
import { WcEventMatchStateService } from './wc-event-match-state.service';
import { WcOddsController } from './wc-odds.controller';
import { WcOddsGateway } from './wc-odds.gateway';
import { WcOddsRealtimeService } from './wc-odds-realtime.service';
import { WcOddsSettlementService } from './wc-odds-settlement.service';
import { WcOddsSyncService } from './wc-odds-sync.service';
import { WcTelegramPulseService } from './wc-telegram-pulse.service';

@Module({
  imports: [PrismaModule, OperationModule, PartnersModule, AuthenticationModule, CybersportModule, EventModule, TelegramModule],
  controllers: [WcOddsController],
  providers: [
    OlimpbetAuthService,
    OlimpbetWcService,
    WcBroadcastProxyService,
    WcOddsBetService,
    WcEventMatchStateService,
    WcOddsSyncService,
    WcOddsSettlementService,
    WcOddsGateway,
    WcOddsRealtimeService,
    WcTelegramPulseService,
  ],
  exports: [OlimpbetWcService, WcOddsRealtimeService],
})
export class WcOddsModule {}
