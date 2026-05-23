import { Module } from '@nestjs/common';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PaymentSystemModule } from '../payment-system.module';
import { GreengoPaymentSystemController } from './greengo-payment-system.controller';
import { GreengoPaymentSystemService } from './greengo-payment-system.service';

@Module({
  controllers: [GreengoPaymentSystemController],
  imports: [PaymentSystemModule, AuthenticationModule, PrismaModule],
  providers: [GreengoPaymentSystemService],
})
export class GreengoPaymentSystemModule {}
