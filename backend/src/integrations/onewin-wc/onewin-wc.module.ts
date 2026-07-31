import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '~/prisma/prisma.module';

import { OneWinEsportsBridgeService } from './onewin-esports-bridge.service';
import { OneWinEsportsIndexService } from './onewin-esports-index.service';
import { OneWinEsportsService } from './onewin-esports.service';
import { OneWinFixtureIndexService } from './onewin-fixture-index.service';
import { OneWinHttpClient } from './onewin-http.client';
import { OneWinPushFeedService } from './onewin-push-feed.service';
import { OneWinWcService } from './onewin-wc.service';

@Module({
  exports: [
    OneWinWcService,
    OneWinEsportsService,
    OneWinPushFeedService,
    OneWinEsportsIndexService,
  ],
  imports: [ConfigModule, PrismaModule],
  providers: [
    OneWinHttpClient,
    OneWinFixtureIndexService,
    OneWinPushFeedService,
    OneWinWcService,
    OneWinEsportsIndexService,
    OneWinEsportsBridgeService,
    OneWinEsportsService,
  ],
})
export class OneWinWcModule {}
