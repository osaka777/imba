import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DepositModule } from '~/main/deposit/deposit.module';
import { PromoModalModule } from '~/main/promo-modal/promo-modal.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PayGateCorePaymentSystemController } from './paygatecore-payment-system.controller';
import { PayGateCorePaymentSystemService } from './paygatecore-payment-system.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthenticationModule,
    DepositModule,
    PromoModalModule,
  ],
  controllers: [PayGateCorePaymentSystemController],
  providers: [PayGateCorePaymentSystemService],
  exports: [PayGateCorePaymentSystemService],
})
export class PayGateCorePaymentSystemModule {}
