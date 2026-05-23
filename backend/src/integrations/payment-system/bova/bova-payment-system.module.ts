import { Module } from '@nestjs/common';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PaymentSystemModule } from '../payment-system.module';
import { BovaPaymentSystemController } from './bova-payment-system.controller';
import { BovaPaymentSystemService } from './bova-payment-system.service';

@Module({
  controllers: [BovaPaymentSystemController],
  imports: [PaymentSystemModule, AuthenticationModule, PrismaModule],
  providers: [BovaPaymentSystemService],
})
export class BovaPaymentSystemModule {}
