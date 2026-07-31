import { Module } from '@nestjs/common';

import { BtcUpdownModule } from '~/main/btc-updown/btc-updown.module';
import { OperationModule } from '~/main/operation/operation.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { RaceController } from './race.controller';
import { RaceService } from './race.service';

@Module({
  imports: [PrismaModule, OperationModule, AuthenticationModule, BtcUpdownModule],
  controllers: [RaceController],
  providers: [RaceService],
  exports: [RaceService],
})
export class RaceModule {}
