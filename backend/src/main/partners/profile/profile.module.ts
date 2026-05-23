import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PaymentSystemModule } from '~/integrations/payment-system/payment-system.module';
import { AuthenticationModule } from '~/main/user/authentication/authentication.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  imports: [
    PrismaModule,
    AuthenticationModule,
    PaymentSystemModule,
    ConfigModule,
  ],
  providers: [ProfileService],
})
export class ProfileModule {}
