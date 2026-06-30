import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PaymentSystemModule } from '~/integrations/payment-system/payment-system.module';
import { AuthenticationModule } from '~/main/partners/authentication/authentication.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  imports: [
    PrismaModule,
    PartnersModule,
    AuthenticationModule,
    PaymentSystemModule,
    ConfigModule,
  ],
  providers: [ProfileService],
})
export class ProfileModule {}
