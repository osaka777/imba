import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '~/prisma/prisma.module';
import { PaymentSystemModule } from '../payment-system.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';

import { NirvanaPayPayinService } from './nirvanapay-payin.service';
import { NirvanaPayPayinController } from './nirvanapay-payin.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PaymentSystemModule,
    AuthenticationModule,
  ],
  controllers: [NirvanaPayPayinController],
  providers: [NirvanaPayPayinService],
  exports: [NirvanaPayPayinService],
})
export class NirvanaPayPayinModule {}