import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '~/prisma/prisma.module';

import { OlimpbetAuthService } from '../olimpbet-wc/olimpbet-auth.service';
import { OlimpbetHttpClient } from '../olimpbet-wc/olimpbet-http.client';
import { OlimpbetWcService } from '../olimpbet-wc/olimpbet-wc.service';
import { KickChannelLiveModule } from '../kick-live/kick-channel-live.module';
import { EsportsStreamResolverService } from '../kick-live/esports-stream-resolver.service';

import { CybersportController } from './cybersport.controller';
import { CybersportService } from './cybersport.service';
import { CybersportWcBridgeService } from './cybersport-wc-bridge.service';

@Module({
  imports: [ConfigModule, PrismaModule, KickChannelLiveModule],
  controllers: [CybersportController],
  providers: [
    CybersportService,
    CybersportWcBridgeService,
    OlimpbetAuthService,
    OlimpbetHttpClient,
    OlimpbetWcService,
  ],
  exports: [CybersportService],
})
export class CybersportModule {}
