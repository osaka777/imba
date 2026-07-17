import { Module, forwardRef } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickChallengeService } from './kick-challenge.service';

@Module({
  imports: [PrismaModule, forwardRef(() => OperationModule)],
  providers: [KickChallengeService],
  exports: [KickChallengeService],
})
export class KickChallengeModule {}
