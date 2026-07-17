import { Module } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';
import { WcOddsModule } from '~/integrations/wc-odds/wc-odds.module';

import { KickGuessContestService } from './kick-guess-contest.service';

@Module({
  imports: [PrismaModule, WcOddsModule],
  providers: [KickGuessContestService],
  exports: [KickGuessContestService],
})
export class KickGuessContestModule {}
