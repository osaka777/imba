import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { NirvanaPayPayinModule } from '~/integrations/payment-system/nirvanapay-payin/nirvanapay-payin.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { PrismaModule } from '~/prisma/prisma.module';
import { OperationModule } from '~/main/operation/operation.module';
import { EventModule } from '~/main/event/event.module';
import { BonusBalanceModule } from '~/main/bonus-balance/bonus-balance.module';

import { DepositController } from './deposit.controller';
import { DepositService } from './deposit.service';
import { DepositCleanupService } from './deposit-cleanup.service';
import { DepositUserNotifyService } from './deposit-user-notify.service';
import { DepositCreditService } from './deposit-credit.service';
import { UsdtTrc20MonitorService } from './usdt-trc20-monitor.service';
import { PromoModalModule } from '../promo-modal/promo-modal.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    ConfigModule,
    AuthenticationModule,
    NirvanaPayPayinModule,
    PrismaModule,
    OperationModule,
    EventModule,
    PromoModalModule,
    PartnersModule,
    TelegramModule,
    PushModule,
    forwardRef(() => BonusBalanceModule),
  ],
  controllers: [DepositController],
  providers: [
    DepositService,
    DepositCleanupService,
    DepositUserNotifyService,
    DepositCreditService,
    UsdtTrc20MonitorService,
  ],
  exports: [DepositService, DepositUserNotifyService, DepositCreditService],
})
export class DepositModule {}