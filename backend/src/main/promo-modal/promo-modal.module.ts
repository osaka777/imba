import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { BonusBalanceModule } from '../bonus-balance/bonus-balance.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import {
  AdminPromoModalController,
  PublicPromoModalController,
} from './promo-modal.controller';
import { PromoModalService } from './promo-modal.service';

@Module({
  imports: [PrismaModule, AuthenticationModule, BonusBalanceModule],
  controllers: [PublicPromoModalController, AdminPromoModalController],
  providers: [PromoModalService],
  exports: [PromoModalService],
})
export class PromoModalModule {}
