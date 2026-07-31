import { Module } from '@nestjs/common';

import { AdminAuditService } from '~/main/admin/admin-audit.service';
import { EventModule } from '~/main/event/event.module';
import { TelegramModule } from '~/main/telegram/telegram.module';
import { OperationModule } from '~/main/operation/operation.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { AdminPermissionGuard } from '~/main/user/authentication/admin-permission.guard';
import { PrismaModule } from '~/prisma/prisma.module';

import { PredictionAdminController } from './prediction.admin.controller';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';

@Module({
  imports: [
    PrismaModule,
    OperationModule,
    AuthenticationModule,
    TelegramModule,
    EventModule,
  ],
  controllers: [PredictionController, PredictionAdminController],
  providers: [
    PredictionService,
    AdminPermissionGuard,
    AdminAuditService,
  ],
  exports: [PredictionService],
})
export class PredictionModule {}
