import { Module } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
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

@Module({
  imports: [PrismaModule, OperationModule, AuthenticationModule, CybersportModule],
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
  ],
  exports: [OlimpbetWcService, WcOddsRealtimeService],
})
export class WcOddsModule {}
