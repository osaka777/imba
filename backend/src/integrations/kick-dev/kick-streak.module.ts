import { Module, forwardRef } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickStreakService } from './kick-streak.service';

@Module({
  imports: [PrismaModule, forwardRef(() => OperationModule)],
  providers: [KickStreakService],
  exports: [KickStreakService],
})
export class KickStreakModule {}
