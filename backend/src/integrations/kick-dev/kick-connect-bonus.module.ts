import { Module, forwardRef } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickConnectBonusService } from './kick-connect-bonus.service';

@Module({
  imports: [PrismaModule, forwardRef(() => OperationModule)],
  providers: [KickConnectBonusService],
  exports: [KickConnectBonusService],
})
export class KickConnectBonusModule {}
