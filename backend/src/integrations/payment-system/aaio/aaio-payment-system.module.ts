import { Module } from '@nestjs/common';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';

import { PaymentSystemModule } from '../payment-system.module';
import { AaioPaymentSystemController } from './aaio-payment-system.controller';
import { AAIOPaymentSystemService } from './aaio-payment-system.service';

@Module({
  controllers: [AaioPaymentSystemController],
  imports: [PaymentSystemModule, AuthenticationModule],
  providers: [AAIOPaymentSystemService],
})
export class AAIOPaymentSystemModule {}
