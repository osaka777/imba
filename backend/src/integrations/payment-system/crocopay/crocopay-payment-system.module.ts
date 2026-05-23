import { Module } from '@nestjs/common';

import { OperationModule } from '~/main/operation/operation.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PaymentSystemModule } from '../payment-system.module';
import { CrocoPayPaymentSystemController } from './crocopay-payment-system.controller';
import { CrocoPayPaymentSystemService } from './crocopay-payment-system.service';

@Module({
  controllers: [CrocoPayPaymentSystemController],
  imports: [
    PaymentSystemModule,
    AuthenticationModule,
    PrismaModule,
    OperationModule,
  ],
  providers: [CrocoPayPaymentSystemService],
})
export class CrocoPayPaymentSystemModule {}
