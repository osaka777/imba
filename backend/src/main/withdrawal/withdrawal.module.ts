import { Module } from '@nestjs/common';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalService } from './withdrawal.service';
import { PrismaModule } from '~/prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { ConfigModule } from '@nestjs/config';
import { OperationModule } from '../operation/operation.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    PrismaModule,
    AuthenticationModule,
    ConfigModule,
    OperationModule,
    TelegramModule,
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