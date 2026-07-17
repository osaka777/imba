import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';

import { KickLiveNotifyModule } from '~/integrations/kick-dev/kick-live-notify.module';
import { KickConnectBonusModule } from '~/integrations/kick-dev/kick-connect-bonus.module';
import { KickChallengeModule } from '~/integrations/kick-dev/kick-challenge.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { OperationModule } from '../operation/operation.module';
import { AffiliatePostbackService } from './affiliate-postback.service';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';

@Module({
  controllers: [PartnersController],
  exports: [PartnersService, AffiliatePostbackService],
  imports: [HttpModule, PrismaModule, forwardRef(() => OperationModule), KickLiveNotifyModule, KickConnectBonusModule, KickChallengeModule],
  providers: [PartnersService, AffiliatePostbackService],
})
export class PartnersModule {}
