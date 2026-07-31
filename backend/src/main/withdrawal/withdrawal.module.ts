import { Module } from '@nestjs/common';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalService } from './withdrawal.service';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { ConfigModule } from '@nestjs/config';
import { OperationModule } from '../operation/operation.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PushModule } from '../push/push.module';
import { BonusBalanceModule } from '../bonus-balance/bonus-balance.module';
import { PhoneVerificationModule } from '../user/phone-verification.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    PrismaModule,
    AuthenticationModule,
    ConfigModule,
    OperationModule,
    TelegramModule,
    PushModule,
    BonusBalanceModule,
    PhoneVerificationModule,
    AdminModule,
  ],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
  exports: [WithdrawalService],
})
export class WithdrawalModule {
  constructor() {
    console.log('WithdrawalModule initialized');
  }
}
