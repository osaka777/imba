import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import {
  AdminPaymentSettingsController,
  PublicPaymentSettingsController,
} from './payment-settings.controller';

@Module({
  imports: [AuthenticationModule],
  controllers: [AdminPaymentSettingsController, PublicPaymentSettingsController],
})
export class PaymentSettingsModule {}
