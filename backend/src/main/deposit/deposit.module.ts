import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { NirvanaPayPayinModule } from '~/integrations/payment-system/nirvanapay-payin/nirvanapay-payin.module';
import { PrismaModule } from '~/prisma/prisma.module';
import { OperationModule } from '~/main/operation/operation.module';
import { EventModule } from '~/main/event/event.module';

import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { DepositCleanupService } from './deposit-cleanup.service';
import { DepositUserNotifyService } from './deposit-user-notify.service';

@Module({
  imports: [
    ConfigModule,
    AuthenticationModule,
    NirvanaPayPayinModule,
    PrismaModule,
    OperationModule,
    EventModule,
  ],
  controllers: [DepositController],
  providers: [DepositService, DepositCleanupService, DepositUserNotifyService],
  exports: [DepositService, DepositUserNotifyService],
})
export class DepositModule {}