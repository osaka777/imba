import { Module } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickStreamRaceService } from './kick-stream-race.service';

@Module({
  imports: [PrismaModule, OperationModule],
  providers: [KickStreamRaceService],
  exports: [KickStreamRaceService],
})
export class KickStreamRaceModule {}
