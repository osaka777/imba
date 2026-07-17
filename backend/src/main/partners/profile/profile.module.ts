import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PaymentSystemModule } from '~/integrations/payment-system/payment-system.module';
import { WcOddsModule } from '~/integrations/wc-odds/wc-odds.module';
import { AuthenticationModule } from '~/main/partners/authentication/authentication.module';
import { PartnersModule } from '~/main/partners/partners.module';
import { PrismaModule } from '~/prisma/prisma.module';

import { PartnerLandingPublicController } from './partner-landing-public.controller';
import { PartnerLandingService } from './partner-landing.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController, PartnerLandingPublicController],
  imports: [
    PrismaModule,
    PartnersModule,
    AuthenticationModule,
    PaymentSystemModule,
    ConfigModule,
    WcOddsModule,
  ],
  providers: [ProfileService, PartnerLandingService],
})
export class ProfileModule {}
