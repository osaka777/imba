import { Module } from '@nestjs/common';

import { AuthenticationModule } from '~/main/user/authentication/authentication.module';

import { PaymentSystemModule } from '../payment-system.module';
import { PaylinkPaymentSystemController } from './paylink-payment-system.controller';
import { PaylinkPaymentSystemService } from './paylink-payment-system.service';

@Module({
  controllers: [PaylinkPaymentSystemController],
  imports: [PaymentSystemModule, AuthenticationModule],
  providers: [PaylinkPaymentSystemService],
})
export class PaylinkPaymentSystemModule {}
