import { Module, forwardRef } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { KickMonthSprintService } from './kick-month-sprint.service';

@Module({
  imports: [PrismaModule, forwardRef(() => OperationModule), forwardRef(() => TelegramModule)],
  providers: [KickMonthSprintService],
  exports: [KickMonthSprintService],
})
export class KickMonthSprintModule {}
