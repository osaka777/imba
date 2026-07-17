import { Module, forwardRef } from '@nestjs/common';
import { BonusBalanceController } from './bonus-balance.controller';
import { PromoController } from './promo.controller';
import { BonusBalanceService } from './bonus-balance.service';
import { AutoBonusService } from './auto-bonus.service';
import { BonusExpiryCleanupService } from './bonus-expiry-cleanup.service';
import { BonusExpiryNotifyService } from './bonus-expiry-notify.service';
import { WeeklyCashbackService } from './weekly-cashback.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthenticationModule } from '../user/authentication/authentication.module';
import { PartnersModule } from '../partners/partners.module';
import { TelegramModule } from '../telegram/telegram.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthenticationModule),
    PartnersModule,
    forwardRef(() => TelegramModule),
    PushModule,
  ],
  controllers: [BonusBalanceController, PromoController],
  providers: [
    BonusBalanceService,
    AutoBonusService,
    BonusExpiryCleanupService,
    BonusExpiryNotifyService,
    WeeklyCashbackService,
  ],
  exports: [BonusBalanceService, AutoBonusService],
})
export class BonusBalanceModule {}
